# object-input-stream

Java's ObjectInputStream for JavaScript.

Read Java serialized objects in Node and in the browser.

## Basic Usage

#### Create Stream

```js
import ObjectInputStream from 'object-input-stream';

const data = new Uint8Array( /* Java object serialization stream data */ );
const ois = new ObjectInputStream(data);
```

#### Read Raw Bytes

```js
ois.read1();       // unsigned byte. -1 if not available
ois.read(5);       // up to 5 bytes as Uint8Array
ois.readFully(5);  // exactly 5 bytes as Uint8Array. EOFException if not available
```

#### Read Primitive Values

```js
ois.readByte();           // number
ois.readUnsignedByte();   // number
ois.readChar();           // utf-16 code unit. JS string of length 1
ois.readShort();          // number
ois.readUnsignedShort();  // number
ois.readInt();            // number
ois.readLong();           // bigint
ois.readFloat();          // number
ois.readDouble();         // number
ois.readUTF();            // string
```

#### Read Objects

```js
ois.readObject();
```

May return:

- Null
- Class instance
- String
- Array
- Enum constant
- Class
- Class descriptor (ObjectStreamClass instance)
- Any value returned by a custom `readResolve` method

## Advanced Usage

### Class Handlers

On the first time a class descriptor is read from stream (either by itself or as part of a class / object), a JavaScript class is selected or dynamically created to correspond to it.
When a class object occurs in stream, its corresponding JavaScript class will be returned from `readObject`.
When an object occurs in stream, it will be instantiated using the 0-argument constructor of the JavaScript class that corresponds to its Java class, and then deserialized using its `readObject`, `readExternal`, and/or `readResolve` methods.

#### Custom Class Handlers

You can "register" classes with an ObjectInputStream, so that when they occur in stream, your class with be selected:

```js
ois.registerSerializable("fully.qualified.ClassName", SerializableClass);
ois.registerExternalizable("fully.qualified.ClassName", ExternalizableClass);
ois.registerEnum("fully.qualified.ClassName", EnumObject);
ois.registerClass("fully.qualified.ClassName", GeneralClass);
```

##### Serializable Classes

```ts
import { ObjectInputStream, Serializable } from 'object-input-stream';

class CustomSerializable implements Serializable {
    // Optional
    // If exists and different from the one on stream when an instance is deserialized, failes with InvalidClassException
    static readonly serialVersionUID: bigint
    // Optional
    readObject(ois: ObjectInputStream): void {
        // You can use ois, exactly the same as in Java
        // ois.readFields() and ois.defaultReadObject() are available
    }
    // Optional
    readResolve(): any {
        // If exists on a deserialized instance, this method is called
        // and its return value replaces the instance itself
    }
}

ois.registerSerializable("com.mypackage.CustomSerializable", CustomSerializable);
```

> Warning: Java serializable classes that don't write their fields before writing anything else to stream MUST have a custom handler class that replicates that behavior. Not doing that could lead to undefined behavior.

> Note: if you recreate and register an entire inheritence chain of serializable classes, their `readObject` methods will be called in order, same as in Java. For every class in the chain that doesn't have a JavaScript handler / where the handler class doesn't have a `readObject` method, `ois.defaultReadObject` is called, again, same as in Java.

##### Externalizable Classes

```ts
import { ObjectInputStream, Externalizable } from 'object-input-stream';

class CustomExternalizable implements Externalizable {
    // Optional
    readExternal(ois: ObjectInputStream): void {
        // You can use ois, exactly the same as in Java
    }
    // Optional
    readResolve(): any {
        // If exists on a deserialized instance, this method is called
        // and its return value replaces the instance itself
    }
}

ois.registerExternalizable("com.mypackage.CustomExternalizable", CustomExternalizable);
```

> Warning: Java externalizable objects written using `PROTOCOL_VERSION_1` MUST have a custom handler class that reads all written data to stream. Not doing that could lead to undefined behavior.

##### Enum Objects

```ts
import { ObjectInputStream, Enum } from 'object-input-stream';

const CustomEnum: Enum = {
    constantName1: constantValue1,
    constantName2: constantValue2,
    constantName3: constantValue3,
    constantName4: constantValue4,
}

ois.registerEnum("com.mypackage.CustomEnum", CustomEnum);

// If CustomEnum.constantName1 is read from stream, ois.readObject() will return constantValue1.
// If CustomEnum.class is read, the CustomEnum object itself will be returned.
```

##### General Classes

```ts
const CustomClass: any = /* literally anything */

ois.registerEnum("com.mypackage.CustomClass", CustomClass);

// A non-serializable, non-externalizable, non-enum class instance cannot be written to stream.
// If the class object itself is read from stream, whatever you registered will be returned.
```

##### Proxy Classes

It is not possible to register proxy classes. They are always dynamically generated - just like in Java.

#### Dynamically Generated Class Handlers

##### Serializable Classes

Dynamically generated serializable class handlers are of the following structure:

```ts
class ExampleSerializable {
    // Class descriptor
    static readonly $desc: ObjectStreamClass
    // Fields deserialized using ois.defaultReadObject()
    [field: string]: any
    // Object annotation. Any extra data written by writeObject() methods after the fields
    $annotation: any[][]
    // Populates fields and annotation
    readObject(ois: ObjectInputStream): void
}
```

##### Externalizable Classes

Dynamically generated externalizable class handlers are of the following structure:

```ts
class ExampleExternalizable {
    // Class descriptor
    static readonly $desc: ObjectStreamClass
    // Object annotation. All data written by the writeExternal() method 
    $annotation: any[]
    // Populates annotation
    readExternal(ois: ObjectInputStream): void
}
```

##### Enum Objects

Dynamically generated enum object handlers are of the following structure:

```ts
class ExampleEnum {
    // Class descriptor
    static readonly $desc: ObjectStreamClass
    // Creates a proxy object around itself, where for any string s, this[s] is s itself.
    // This means that enum constants are read as just the string constant names themselves.
    constructor()
}
```

##### General Classes

Dynamically generated general class handlers are of the following structure:

```ts
class ExampleEnum {
    // Class descriptor
    static readonly $desc: ObjectStreamClass
}
```

##### Proxy Classes

Dynamically generated general class handlers are of the following structure:

```ts
class ExampleProxy {
    // A list of the proxy interface names associated with the class
    static readonly proxyInterfaces: string[] = []
    // The proxy handler class / lambda from Java
    h?: InvocationHandler
    // Creates a proxy object that calls this.h on property access
    constructor(h?: InvocationHandler)
}

interface InvocationHandler {
    invoke: (proxy: BaseProxy, method: string, args: any[]) => any
}
```

#### Built-in Class Handlers

Primitive wrapper types have built-in handler classes that implement `readResolve` to replace instances with their primitive values. E.g. if the next object on stream is an `Integer` of value 5 and you call `readObject`, it will return the primitive value `5`.

- `java.lang.Byte`
- `java.lang.Short`
- `java.lang.Integer`
- `java.lang.Long`
- `java.lang.Float`
- `java.lang.Double`
- `java.lang.Character`
- `java.lang.Boolean`

Some standard library container types also have built-in handler classes, which extend the corresponding JavaScript container types (`Array`, `Set`, `Map`).

- `java.util.ArrayList`
- `java.util.LinkedList`
- `java.util.ArrayDeque`
- `java.util.HashSet`
- `java.util.LinkedHashSet`
- `java.util.TreeSet`
- `java.util.HashMap`
- `java.util.LinkedHashMap`
- `java.util.TreeMap`

> NOTE: in JavaScript, `Set`s and `Map`s determine item equlity using the strict equality operator `===`, not `equals()`, `hashCode()` or `compareTo()` methods.

##### Overriding Built-in Class Handlers

You can override any handler at any moment by calling `registerSerializable`, `registerExternalizable`, `registerEnum` or `registerClass`. You can only do so before the corresponding class descriptor is read from stream, or after a reset.

You can also decide which classes (if any) are considered built-in by passing a second `info` parameter to `ObjectInputStream`.

```ts
type OisOptions = {
    // Mappings between built-in "fully.qualified.ClassNames" and their handlers
    initialClasses?: {
        serializable?: Map<string, SerializableCtor>,
        externalizable?: Map<string, ExternalizableCtor>,
        enum?: Map<string, Enum>,
        general?: Map<string, any>,
    }
}
```

## AST

```js
import { ObjectInputStreamAST } from 'object-input-stream';

const data = new Uint8Array( /* Java object serialization stream data */ );
const ois = new ObjectInputStream(data);

// Read everything

const ast = ois.getAST();
```

> WARNING: The AST structure and API are unstable, and may change at any type.

## Limitations

- Requires a runtime that supports `bigint` (all modern runtimes)
- Doesn't support strings over 9 petabytes in size (`Number.MAX_SAFE_INTEGER` bytes)

## TODO

- [X] ObjectInputStreamAST class: emit AST after parsing
- [X] Complete existing tests
- [ ] Expand tests
    - [X] Classes
    - [X] Class descriptors
    - [ ] Proxy classes
    - [ ] Enums
    - [ ] java.util handlers
    - [ ] Sudden death: a brazillian randomly generated primitives and objects with a complex reference graph and readObject/readExternal
