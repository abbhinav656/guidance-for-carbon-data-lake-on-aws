import { Duration, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { aws_stepfunctions_tasks as tasks } from 'aws-cdk-lib';
import { aws_stepfunctions as sfn } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib'
import { Construct } from 'constructs';

interface StateMachineProps extends NestedStackProps {
  dataLineageFunction: lambda.Function,
  dataQualityJob: any,
  glueTransformJob: any,
  calculationJob: any
}

export class CarbonlakeQuickstartStatemachineStack extends NestedStack {
  public readonly statemachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: StateMachineProps) {
    super(scope, id, props);

    /* ======== STEP FUNCTION TASKS ======== */

    // SFN Success State
    const sfnSuccess = new sfn.Succeed(this, 'Success');

    // SFN Failure State
    const sfnFailure = new sfn.Fail(this, 'Failure');

    // Data Lineage Request - 0 - RAW_DATA_INPUT
    const dataLineageTask0 = new tasks.LambdaInvoke(this, 'DL: RAW_DATA_INPUT', {
      lambdaFunction: props.dataLineageFunction,
      payloadResponseOnly: true,
      payload: this.getCommonDataLineageParameters("RAW_DATA_INPUT"),
      resultPath: '$.data_lineage',
    });

    // Data Quality Check
    const dataQualityTask = new sfn.Pass(this, 'LAMBDA: Data Quality Check', {
      inputPath: '$.file',
      result: sfn.Result.fromObject({ result: 'PASSED' }),
      resultPath: '$.data_quality'
    });

    // CHOICE - Data Quality Check Passed?
    const dataQualityChoice = new sfn.Choice(this, 'CHOICE: Data Quality Passed?')

    // Data Lineage Request - 1_1 - DQ_CHECK_PASS
    const dataLineageTask1_1 = new tasks.LambdaInvoke(this, 'DL: DQ_CHECK_PASS', {
      lambdaFunction: props.dataLineageFunction,
      payloadResponseOnly: true,
      payload: this.getCommonDataLineageParameters("DQ_CHECK_PASS"),
      resultPath: '$.data_lineage',
    });

    // Data Lineage Request - 1_2 - DQ_CHECK_FAIL
    const dataLineageTask1_2 = new tasks.LambdaInvoke(this, 'DL: DQ_CHECK_FAIL', {
      lambdaFunction: props.dataLineageFunction,
      payloadResponseOnly: true,
      payload: this.getCommonDataLineageParameters("DQ_CHECK_FAIL"),
      resultPath: '$.data_lineage',
    });

    // Human-in-the-loop approval step - invoked on data quality check fail
    const humanApprovalTask = new sfn.Pass(this, 'SNS: Human Approval Step');

    // Transformation Glue Job - split large input file into optimised batches with known schema
    // const transflowGlueTask = new tasks.GlueStartJobRun(this, 'carbonlakeTransfromGlueTask', {})
    const transformGlueTask = new sfn.Pass(this, 'GLUE: Synchronous Transform', {
      result: sfn.Result.fromObject({
        location: "s3://<transformed_bucket>/<node_id>",
        num_files: 5
      }),
      resultPath: '$.glue_output'
    });

    // Lambda function to determine number and location of batches created by AWS Glue
    const batchLambdaTask = new sfn.Pass(this, 'LAMBDA: Handle Batch Data', {
      result: sfn.Result.fromArray([
        { location: "s3://<transformed_bucket>/<node_id>/batch1.json" },
        { location: "s3://<transformed_bucket>/<node_id>/batch2.json" },
        { location: "s3://<transformed_bucket>/<node_id>/batch3.json" },
        { location: "s3://<transformed_bucket>/<node_id>/batch4.json" },
        { location: "s3://<transformed_bucket>/<node_id>/batch5.json" }
      ]),
      resultPath: '$.batches'
    });

    // Data Lineage Request - 2 - GLUE_BATCH_SPLIT
    const dataLineageTask2 = new tasks.LambdaInvoke(this, 'DL: GLUE_BATCH_SPLIT', {
      lambdaFunction: props.dataLineageFunction,
      payloadResponseOnly: true,
      payload: this.getCommonDataLineageParameters("GLUE_BATCH_SPLIT"),
      resultPath: '$.data_lineage',
    });

    // Dynamic Map State - Run n calculations depending on number of batches
    const dynamicMapState = new sfn.Map(this, 'MAP: Iterate Batches', {
      maxConcurrency: 40,
      inputPath: '$',
      itemsPath: "$.batches",
      parameters: {
        "location": sfn.JsonPath.objectAt("$$.Map.Item.Value.location"),
        "data_lineage": sfn.JsonPath.stringAt('$.data_lineage')
      },
      resultPath: '$.batch_results'
    });

    // Calculation Lambda function - pass in the batch to be processed
    const calculationLambdaTask = new sfn.Pass(this, 'LAMBDA: Calculate CO2 Equivalent', {
      inputPath: sfn.JsonPath.stringAt("$.location"),
      result: sfn.Result.fromString("s3://<enriched_bucket>/<node_id>/<batch_id>.json"),
      resultPath: "$.calculation_results"
    });

    // Data Lineage Request - 3 - CALCULATION_COMPLETE
    const dataLineageTask3 = new tasks.LambdaInvoke(this, 'DL: CALCULATION_COMPLETE', {
      lambdaFunction: props.dataLineageFunction,
      payloadResponseOnly: true,
      payload: this.getCommonDataLineageParameters("CALCULATION_COMPLETE"),
      resultPath: '$.data_lineage',
    })
    

    /* ======== STEP FUNCTION ======== */

    // State machine definition
    const definition = sfn.Chain
      .start(dataLineageTask0)
      .next(dataQualityTask)
      .next(dataQualityChoice
        .when(
          sfn.Condition.stringEquals('$.data_quality.result', "PASSED"),
          sfn.Chain
            .start(dataLineageTask1_1)
            .next(transformGlueTask)
            .next(batchLambdaTask)
            .next(dataLineageTask2)
            .next(dynamicMapState.iterator(sfn.Chain
              .start(calculationLambdaTask)
              .next(dataLineageTask3)
            ))
            .next(sfnSuccess)
        )
        .otherwise(sfn.Chain
          .start(humanApprovalTask)
          .next(dataLineageTask1_2)
          .next(sfnFailure)
        )
      )

    this.statemachine = new sfn.StateMachine(this, 'carbonlakePipeline', {
      definition,
      timeout: Duration.minutes(15)
    });
  }

  private getCommonDataLineageParameters = (action: string) : sfn.TaskInput => {
    return sfn.TaskInput.fromObject({
      "root_id": sfn.JsonPath.stringAt("$.data_lineage.root_id"),
      "parent_id": sfn.JsonPath.stringAt("$.data_lineage.parent_id"),
      "storage_type":  sfn.JsonPath.stringAt("$.data_lineage.storage_type"),
      "storage_location": sfn.JsonPath.stringAt("$.data_lineage.storage_location"),
      "action": action
    });
  }
}