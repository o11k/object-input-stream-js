import type { Serializable, SerializableCtor, Enum, ObjectInputStream, ExternalizableCtor } from '.';
import { InvalidObjectException } from './exceptions';

export namespace java {
    export namespace lang {
        export class Byte implements Serializable {
            static readonly serialVersionUID: bigint = -7183698231559129828n;
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Short implements Serializable {
            static readonly serialVersionUID: bigint = 7515723908773894738n;
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Integer implements Serializable {
            static readonly serialVersionUID: bigint = 1360826667806852920n;
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Long implements Serializable {
            static readonly serialVersionUID: bigint = 4290774380558885855n;
            value: bigint = 0n;
            readResolve() { return this.value; }
        }
        export class Float implements Serializable {
            static readonly serialVersionUID: bigint = -2671257302660747028n;
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Double implements Serializable {
            static readonly serialVersionUID: bigint = -9172774392245257468n;
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Character implements Serializable {
            static readonly serialVersionUID: bigint = 3786198910865385080n;
            value: string = '\0';
            readResolve() { return this.value; }
        }
        export class Boolean implements Serializable {
            static readonly serialVersionUID: bigint = -3665804199014368530n;
            value: boolean = false;
            readResolve() { return this.value; }
        }
    }

    export namespace util {
        export class ArrayList extends Array implements Serializable {
            static readonly serialVersionUID: bigint = 8683452581122892189n;
            readObject(ois: ObjectInputStream): void {
                // Read size from fields
                const size = ois.readFields().get("size");
                if (typeof size !== "number" || size < 0)
                    throw new InvalidObjectException("Invalid size: " + size)

                // Read and ignore capacity
                ois.readInt();

                // Read all items
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class LinkedList extends Array implements Serializable {
            static readonly serialVersionUID: bigint = 876323262645176354n;
            readObject(ois: ObjectInputStream): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class ArrayDeque extends Array implements Serializable {
            static readonly serialVersionUID: bigint = 2340985798034038923n;
            readObject(ois: ObjectInputStream): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class HashSet extends Set implements Serializable {
            static readonly serialVersionUID: bigint = -5024744406713321676n;
            readObject(ois: ObjectInputStream): void {
                ois.readFields(); // None
                ois.readInt();    // Capacity
                ois.readFloat();  // Load factor

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.add(ois.readObject());
            }
        }

        export class LinkedHashSet extends HashSet {
            static readonly serialVersionUID: bigint = -2851667679971038690n;
        }

        export class TreeSet extends Set implements Serializable {
            static readonly serialVersionUID: bigint = -2479143000061671589n;
            readObject(ois: ObjectInputStream): void {
                ois.readFields();
                ois.readObject();  // Comparator

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.add(ois.readObject());
            }
        }

        export class HashMap extends Map implements Serializable {
            static readonly serialVersionUID: bigint = 362498820763181265n;
            readObject(ois: ObjectInputStream): void {
                ois.readFields();
                ois.readInt();

                const size = ois.readInt();
                for (let i=0; i<size; i++) {
                    const key = ois.readObject();
                    const val = ois.readObject();
                    this.set(key, val);
                }
            }
        }

        export class LinkedHashMap extends HashMap {
            static readonly serialVersionUID: bigint = 3801124242820219131n;
        }

        export class TreeMap extends Map implements Serializable {
            static readonly serialVersionUID: bigint = 919286545866124006n;
            readObject(ois: ObjectInputStream): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++) {
                    const key = ois.readObject();
                    const val = ois.readObject();
                    this.set(key, val);
                }
            }
        }
    }
}

export const builtinSerializables = new Map<string, SerializableCtor>([
    ["java.lang.Byte", java.lang.Byte],
    ["java.lang.Short", java.lang.Short],
    ["java.lang.Integer", java.lang.Integer],
    ["java.lang.Long", java.lang.Long],
    ["java.lang.Float", java.lang.Float],
    ["java.lang.Double", java.lang.Double],
    ["java.lang.Character", java.lang.Character],
    ["java.lang.Boolean", java.lang.Boolean],

    ["java.util.ArrayList", java.util.ArrayList],
    ["java.util.LinkedList", java.util.LinkedList],
    ["java.util.ArrayDeque", java.util.ArrayDeque],
    ["java.util.HashSet", java.util.HashSet],
    ["java.util.LinkedHashSet", java.util.LinkedHashSet],
    ["java.util.TreeSet", java.util.TreeSet],
    ["java.util.HashMap", java.util.HashMap],
    ["java.util.LinkedHashMap", java.util.LinkedHashMap],
    ["java.util.TreeMap", java.util.TreeMap],
]);

export const builtinExternalizables = new Map<string, ExternalizableCtor>([]);
export const builtinEnums = new Map<string, Enum>([]);
export const builtinClasses = new Map<string, any>([]);
