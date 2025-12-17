export class JavaException extends Error {}
export class IOException extends JavaException {}
export class ObjectStreamException extends IOException {}
export class StreamCorruptedException extends ObjectStreamException {}
export class EOFException extends IOException {}
export class UTFDataFormatException extends IOException {}
export class RuntimeException extends JavaException {}
export class IllegalStateException extends RuntimeException {}
export class IndexOutOfBoundsException extends RuntimeException {}
export class OptionalDataException extends ObjectStreamException {}
export class InvalidClassException extends ObjectStreamException {}
export class ReflectiveOperationException extends JavaException {}
export class ClassNotFoundException extends ReflectiveOperationException {}
export class NotActiveException extends ObjectStreamException {}
export class InvalidObjectException extends ObjectStreamException {}

export class NotImplementedError extends Error {}  // TODO remove before publishing
