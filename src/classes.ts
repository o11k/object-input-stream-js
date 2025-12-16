import { InvalidObjectException, J, NotImplementedError, ObjectInputStream, Serializable } from ".";

export namespace java {
    export namespace lang {
        export class Byte implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Short implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Integer implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Long implements Serializable {
            value: bigint = 0n;
            readResolve() { return this.value; }
        }
        export class Float implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Double implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Character implements Serializable {
            value: string = '\0';
            readResolve() { return this.value; }
        }
        export class Boolean implements Serializable {
            value: boolean = false;
            readResolve() { return this.value; }
        }
    }

    export namespace util {
        export class ArrayList extends Array implements Serializable {
            readObject(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
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
            readObject(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class ArrayDeque extends Array implements Serializable {
            readObject(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class HashSet extends Set implements Serializable {
            readObject(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
                ois.readFields(); // None
                ois.readInt();    // Capacity
                ois.readFloat();  // Load factor

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.add(ois.readObject());
            }
        }

        export class LinkedHashSet extends HashSet {}

        export class TreeSet extends Set implements Serializable {
            readObject(ois: ObjectInputStream, classDesc: J.ClassDesc): void {
                ois.readFields();

                const comparator = ois.readObject();
                if (comparator !== null)
                    throw new NotImplementedError("TreeSet with comparator");

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.add(ois.readObject());
            }
        }
    }
}
