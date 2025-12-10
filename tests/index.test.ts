/// <reference types="jest" />
/// <reference types="node" />

import fs from 'node:fs';

import {JAVAOBJ_SYMBOL, ObjectInputStream} from '../src/index';

describe("example", () => {
    test("symbol name", () => {
        expect(JAVAOBJ_SYMBOL.toString()).toBe("Symbol(javaobj)");
    })
})



test("read primitives", () => {
    const PATH_DIR = "tests/tmp";
    const PATH_TXT = PATH_DIR + "/expected.txt";
    const PATH_SER = PATH_DIR + "/serialized.ser";

    const streamBytes = new Uint8Array(fs.readFileSync(PATH_SER));
    const ois = new ObjectInputStream(streamBytes);

    const methods = Object.freeze({
        B: ois.readByte.bind(ois),
        C: ois.readChar.bind(ois),
        D: ois.readDouble.bind(ois),
        F: ois.readFloat.bind(ois),
        I: ois.readInt.bind(ois),
        J: ois.readLong.bind(ois),
        S: ois.readShort.bind(ois),
        Z: ois.readBoolean.bind(ois),

        L: ois.readObject.bind(ois),
    } as const)

    const expectedLines = fs.readFileSync(PATH_TXT, "utf-8").split("\n");
    for (let i=0; i<expectedLines.length; i++) {
        const expectedLine = expectedLines[i];
        if (expectedLine.length === 0) continue;

        // Read from stream based on typecode
        const typecode = expectedLine[0];
        if (!(typecode in methods)) throw new Error("Unknown typecode: " + typecode);
        const method = methods[typecode as keyof typeof methods];
        const found = method();

        // Read expected value from file
        const expectedStr = expectedLine.slice(1);
        let expected = eval("(" + expectedStr + ")");

        if (typecode === "L") {
          expect(found).toMatchObject(expected);
        } else {
          // We can even expect floats and doubles to be exactly the same, since they are written exactly to stream
          expect(found).toBe(expected);
        }
    }
})
