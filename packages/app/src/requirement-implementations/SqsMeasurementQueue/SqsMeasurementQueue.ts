import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type {
  MeasurementMessage,
  MeasurementQueue,
} from "../../requirements/MeasurementQueue.js";

export default class SqsMeasurementQueue implements MeasurementQueue {
  private sqsClient = new SQSClient({});

  constructor(private queueUrl: string) {}

  async send(message: MeasurementMessage): Promise<void> {
    await this.sqsClient.send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
      }),
    );
  }
}
