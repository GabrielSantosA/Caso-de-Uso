/* eslint-disable @typescript-eslint/no-explicit-any */

import { Field } from "../../../domain/entities/Form";

export interface ValidatorStrategy {
  validate(value: any, field: Field): Promise<void>;
}
