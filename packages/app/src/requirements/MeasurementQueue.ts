export interface MeasurementMessage {
  owner: string;
  repo: string;
}

export interface MeasurementQueue {
  send(message: MeasurementMessage): Promise<void>;
}
