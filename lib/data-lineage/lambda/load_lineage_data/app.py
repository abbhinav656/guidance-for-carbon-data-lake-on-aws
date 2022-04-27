import json
from typing import Dict

from aws_lambda_powertools.logging import Logger
from aws_lambda_powertools.tracing import Tracer
from aws_lambda_powertools.utilities.data_classes import SQSEvent

from handlers import DataHandler

logger = Logger(service="carbonlake", level="debug")
tracer = Tracer()

"""
INPUT: Event from SQS with records to be added to the data lineage ledger
PROCESS: For each input record, fetch additional metadata from CarbonLake and store in DDB
OUTPUT: None
"""


@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler()
def lambda_handler(event: Dict, context: Dict):
    event = SQSEvent(event)
    for record in event.records:
        message = json.loads(record.body)
        logger.info(f"Processing record - child id = {message['child_id']}")

    return
