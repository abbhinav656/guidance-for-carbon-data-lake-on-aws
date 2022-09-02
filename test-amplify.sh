#!/bin/bash

cd front-end/carbonlake-ui-cloudscape || exit
pwd
npm install
wait
npm run build
wait

set -e
IFS='|'
AWS_REGION=$(jq -r '.SharedResources.CLQSAwsRegion' ../../cdk-outputs.json)

REACTCONFIG="{\
\"SourceDir\":\"src\",\
\"DistributionDir\":\"build\",\
\"BuildCommand\":\"npm run-script build\",\
\"StartCommand\":\"npm run-script start\"\
}"

AWSCLOUDFORMATIONCONFIG="{\
\"configLevel\":\"project\",\
\"useProfile\":true,\
\"profileName\":\"$AWS_PROFILE\",\
\"region\":\"$AWS_REGION\"\
}"
AMPLIFY="{\
\"projectName\":\"clqsAmplifyTest\",\
\"defaultEditor\":\"code\",\
\"envName\":\"test\"\
}"
FRONTEND="{\
\"frontend\":\"javascript\",\
\"framework\":\"react\",\
\"config\":$REACTCONFIG\
}"
PROVIDERS="{\
\"awscloudformation\":$AWSCLOUDFORMATIONCONFIG\
}"

API_ID=$(jq -r '.ApiStack.apiId' ../../cdk-outputs.json)
amplify add codegen --"$API_ID"

amplify init \
--amplify $AMPLIFY \
--frontend $FRONTEND \
--providers $PROVIDERS \
--yes
wait

amplify delete --force
echo '🥳 Success! You were able to deploy the Amplify App successfully to localhost and then delete it!'