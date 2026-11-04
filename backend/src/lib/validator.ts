export interface ValidationIssue {
  path: string[];
  message: string;
}

export interface SafeParseSuccess<T> {
  success: true;
  data: T;
}

export interface SafeParseError {
  success: false;
  error: {
    issues: ValidationIssue[];
    flatten: () => { fieldErrors: Record<string, string[]> };
  };
}

export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseError;

export abstract class SchemaField<T = any> {
  protected isOptionalFlag = false;
  protected isNullableFlag = false;
  protected hasDefaultFlag = false;
  protected defaultVal: any = undefined;

  abstract validateValue(val: unknown, path: string[]): { ok: true; value: T } | { ok: false; message: string };

  optional(): this {
    this.isOptionalFlag = true;
    return this;
  }

  nullable(): this {
    this.isNullableFlag = true;
    return this;
  }

  default(val: T): this {
    this.hasDefaultFlag = true;
    this.defaultVal = val;
    this.isOptionalFlag = true;
    return this;
  }

  parseField(val: unknown, path: string[], forceOptional = false): { ok: true; value: any } | { ok: false; message: string } {
    if (val === undefined) {
      if (forceOptional) return { ok: true, value: undefined };
      if (this.hasDefaultFlag) return { ok: true, value: this.defaultVal };
      if (this.isOptionalFlag) return { ok: true, value: undefined };
      return { ok: false, message: `${path.join('.') || 'Field'} is required` };
    }
    if (val === null) {
      if (this.isNullableFlag) return { ok: true, value: null };
      if (forceOptional) return { ok: true, value: null };
      return { ok: false, message: `${path.join('.') || 'Field'} cannot be null` };
    }
    return this.validateValue(val, path);
  }
}

class StringSchema extends SchemaField<string> {
  private minLen = 0;
  private minMsg = 'Invalid string';
  private checkEmail = false;
  private emailMsg = 'Invalid email address';

  min(len: number, msg?: string): this {
    this.minLen = len;
    if (msg) this.minMsg = msg;
    return this;
  }

  email(msg?: string): this {
    this.checkEmail = true;
    if (msg) this.emailMsg = msg;
    return this;
  }

  validateValue(val: unknown, path: string[]) {
    if (typeof val !== 'string') {
      return { ok: false as const, message: `${path.join('.')} must be a string` };
    }
    if (this.minLen > 0 && val.trim().length < this.minLen) {
      return { ok: false as const, message: this.minMsg || `${path.join('.')} must be at least ${this.minLen} characters` };
    }
    if (this.checkEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      return { ok: false as const, message: this.emailMsg };
    }
    return { ok: true as const, value: val };
  }
}

class NumberSchema extends SchemaField<number> {
  private coerceFlag: boolean;
  private minVal?: number;
  private minMsg?: string;
  private maxVal?: number;

  constructor(coerceFlag = false) {
    super();
    this.coerceFlag = coerceFlag;
  }

  min(val: number, msg?: string): this {
    this.minVal = val;
    this.minMsg = msg;
    return this;
  }

  max(val: number): this {
    this.maxVal = val;
    return this;
  }

  validateValue(val: unknown, path: string[]) {
    const num = this.coerceFlag ? Number(val) : typeof val === 'number' ? val : NaN;
    if (typeof num !== 'number' || Number.isNaN(num)) {
      return { ok: false as const, message: `${path.join('.')} must be a valid number` };
    }
    if (this.minVal !== undefined && num < this.minVal) {
      return { ok: false as const, message: this.minMsg || `${path.join('.')} must be at least ${this.minVal}` };
    }
    if (this.maxVal !== undefined && num > this.maxVal) {
      return { ok: false as const, message: `${path.join('.')} must be at most ${this.maxVal}` };
    }
    return { ok: true as const, value: num };
  }
}

class BooleanSchema extends SchemaField<boolean> {
  validateValue(val: unknown, path: string[]) {
    if (typeof val !== 'boolean') {
      return { ok: false as const, message: `${path.join('.')} must be a boolean` };
    }
    return { ok: true as const, value: val };
  }
}

class EnumSchema<T extends readonly string[]> extends SchemaField<T[number]> {
  private allowed: readonly string[];

  constructor(values: T) {
    super();
    this.allowed = values;
  }

  validateValue(val: unknown, path: string[]) {
    if (typeof val !== 'string' || !this.allowed.includes(val)) {
      return {
        ok: false as const,
        message: `${path.join('.')} must be one of: ${this.allowed.join(', ')}`,
      };
    }
    return { ok: true as const, value: val as T[number] };
  }
}

class ArraySchema<T> extends SchemaField<T[]> {
  private itemSchema: SchemaField<T>;

  constructor(itemSchema: SchemaField<T>) {
    super();
    this.itemSchema = itemSchema;
  }

  validateValue(val: unknown, path: string[]) {
    if (!Array.isArray(val)) {
      return { ok: false as const, message: `${path.join('.')} must be an array` };
    }
    const out: T[] = [];
    for (let i = 0; i < val.length; i++) {
      const res = this.itemSchema.parseField(val[i], [...path, String(i)]);
      if (!res.ok) return res;
      out.push(res.value);
    }
    return { ok: true as const, value: out };
  }
}

export class ObjectSchema<S extends Record<string, SchemaField<any>>> {
  private shape: S;
  private isPartial: boolean;

  constructor(shape: S, isPartial = false) {
    this.shape = shape;
    this.isPartial = isPartial;
  }

  partial(): ObjectSchema<S> {
    return new ObjectSchema(this.shape, true);
  }

  safeParse(input: unknown): SafeParseResult<any> {
    const obj = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
    const issues: ValidationIssue[] = [];
    const data: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(this.shape)) {
      const rawVal = obj[key];
      const res = fieldSchema.parseField(rawVal, [key], this.isPartial);
      if (!res.ok) {
        issues.push({ path: [key], message: res.message });
      } else if (res.value !== undefined) {
        data[key] = res.value;
      }
    }

    if (issues.length > 0) {
      return {
        success: false,
        error: {
          issues,
          flatten: () => {
            const fieldErrors: Record<string, string[]> = {};
            for (const issue of issues) {
              const k = issue.path[0] || 'root';
              fieldErrors[k] = fieldErrors[k] || [];
              fieldErrors[k].push(issue.message);
            }
            return { fieldErrors };
          },
        },
      };
    }

    return { success: true, data };
  }
}

export const z = {
  string: () => new StringSchema(),
  number: () => new NumberSchema(false),
  boolean: () => new BooleanSchema(),
  enum: <T extends readonly string[]>(values: T) => new EnumSchema(values),
  array: <T>(item: SchemaField<T>) => new ArraySchema(item),
  object: <S extends Record<string, SchemaField<any>>>(shape: S) => new ObjectSchema(shape),
  coerce: {
    number: () => new NumberSchema(true),
  },
};

