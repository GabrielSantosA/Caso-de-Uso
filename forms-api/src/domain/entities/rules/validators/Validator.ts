/* eslint-disable @typescript-eslint/no-explicit-any */
import { Field } from "../../Form";

export interface ValidatorStrategy {
  validate(value: any, field: Field): Promise<void>;
}
