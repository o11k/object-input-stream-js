package com.o11k;

import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.stream.*;

class Randomizer {
    static final float CHANCE_NAN = 0.05f;
    static final float CHANCE_INFINITY = 0.05f;
    static final float CHANCE_SUBNORMAL = 0.05f;
    static final float CHANCE_ZERO = 0.05f;

    static byte nextByte(Random rnd) { byte[] bs = {0}; rnd.nextBytes(bs); return bs[0]; }
    static char nextChar(Random rnd) { return (char)rnd.nextInt(1 << 16); }
    static double nextDouble(Random rnd) {
        long dBits = rnd.nextLong();
        final long dExponentMask = 0b0__1111_1111_111__0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000L;
        final long dFractionMask = 0b0__0000_0000_000__1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111_1111L;
        final float choice = rnd.nextFloat();
        if (choice < (CHANCE_NAN)) {
            dBits |= dExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY)) {
            dBits |= dExponentMask;
            dBits &= ~dFractionMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL)) {
            dBits &= ~dExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL + CHANCE_ZERO)) {
            dBits &= ~dExponentMask;
            dBits &= ~dFractionMask;
        }
        return Double.longBitsToDouble(dBits);
    }
    static float nextFloat(Random rnd) {
        int fBits = rnd.nextInt();
        final int fExponentMask = 0b0__1111_1111__0000_0000_0000_0000_0000_000;
        final int fFractionMask = 0b0__0000_0000__1111_1111_1111_1111_1111_111;
        final float choice = rnd.nextFloat();
        if (choice < (CHANCE_NAN)) {
            fBits |= fExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY)) {
            fBits |= fExponentMask;
            fBits &= ~fFractionMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL)) {
            fBits &= ~fExponentMask;
        } else if (choice < (CHANCE_NAN + CHANCE_INFINITY + CHANCE_SUBNORMAL + CHANCE_ZERO)) {
            fBits &= ~fExponentMask;
            fBits &= ~fFractionMask;
        }
        return Float.intBitsToFloat(fBits);
    }
    static int nextInt(Random rnd) { return rnd.nextInt(); }
    static long nextLong(Random rnd) { return rnd.nextLong(); }
    static short nextShort(Random rnd) { return (short)rnd.nextInt(1 << 16); }
    static boolean nextBoolean(Random rnd) { return rnd.nextBoolean(); }

    static String nextString(Random rnd) { return UUID.randomUUID().toString(); }  // TODO

    static <T> T nextObject(Random rnd, Class<T> clazz) throws Exception {
        T obj = clazz.getDeclaredConstructor().newInstance();

        for (Field f : clazz.getDeclaredFields()) {
            f.setAccessible(true);

            Class<?> type = f.getType();
            if (type == byte.class || type == Byte.class) {
                f.set(obj, nextByte(rnd));
            } else if (type == char.class || type == Character.class) {
                f.set(obj, nextChar(rnd));
            } else if (type == double.class || type == Double.class) {
                f.set(obj, nextDouble(rnd));
            } else if (type == float.class || type == Float.class) {
                f.set(obj, nextFloat(rnd));
            } else if (type == int.class || type == Integer.class) {
                f.set(obj, nextInt(rnd));
            } else if (type == long.class || type == Long.class) {
                f.set(obj, nextLong(rnd));
            } else if (type == short.class || type == Short.class) {
                f.set(obj, nextShort(rnd));
            } else if (type == boolean.class || type == Boolean.class) {
                f.set(obj, nextBoolean(rnd));
            } else if (!type.isPrimitive()) {
                // recursively fill nested object
                f.set(obj, nextObject(rnd, type));
            }
        }

        return obj;
    }
}

class ToJS {
    static boolean isPrintable(char c) {
        switch (Character.getType(c)) {
            case Character.LOWERCASE_LETTER:
            case Character.MODIFIER_LETTER:
            case Character.OTHER_LETTER:
            case Character.TITLECASE_LETTER:
            case Character.UPPERCASE_LETTER:

            case Character.COMBINING_SPACING_MARK:
            case Character.ENCLOSING_MARK:
            case Character.NON_SPACING_MARK:

            case Character.DECIMAL_DIGIT_NUMBER:
            case Character.LETTER_NUMBER:
            case Character.OTHER_NUMBER:

            case Character.CONNECTOR_PUNCTUATION:
            case Character.DASH_PUNCTUATION:
            case Character.END_PUNCTUATION:
            case Character.FINAL_QUOTE_PUNCTUATION:
            case Character.INITIAL_QUOTE_PUNCTUATION:
            case Character.OTHER_PUNCTUATION:
            case Character.START_PUNCTUATION:

            case Character.CURRENCY_SYMBOL:
            case Character.MODIFIER_SYMBOL:
            case Character.MATH_SYMBOL:
            case Character.OTHER_SYMBOL:
                return true;

            default:
                return false;
        }
    }

    static String charToJS(char c) {
        switch (c) {
            case '"':  return "\\\"";
            case '\'': return "\\'";
            case '\b': return "\\b";
            case '\f': return "\\f";
            case '\n': return "\\n";
            case '\r': return "\\r";
            case '\t': return "\\t";
            case '\\': return "\\\\";
        }

        if (isPrintable(c))
            return Character.toString(c);

        // JSON Unicode escape
        return String.format("\\u%04x", (int)c);
    }

    static String toJs(Object obj) throws Exception {
        if (obj instanceof Byte)      return obj.toString();
        if (obj instanceof Character) return "'" + charToJS((Character)obj) + "'";
        if (obj instanceof Double)    return obj.toString();
        if (obj instanceof Float)     return Double.toString(((Float)obj).doubleValue());
        if (obj instanceof Integer)   return obj.toString();
        if (obj instanceof Long)      return obj.toString() + "n";
        if (obj instanceof Short)     return obj.toString();
        if (obj instanceof Boolean)   return obj.toString();

        if (obj instanceof String) return '"' + ((String)obj).chars().mapToObj(c -> charToJS((char)c)).collect(Collectors.joining()) + '"';

        String result = "";

        result += "{";
        Field[] fields = obj.getClass().getDeclaredFields();
        for (Field field : fields) {
            result += toJs(field.getName()) + ":" + toJs(field.get(obj)) + ",";
        }
        result += "}";

        return result;

    }
}


public class GenerateTests {
    static final float CHANCE_PRIMITIVE = 0.50f;

    static final int NUM_ITEMS_TO_WRITE = 10_000;

    static final String PATH_DIR = "tests/tmp";


    static void writePrimitive(Random rnd, FileWriter outExpected, ObjectOutputStream oos) throws Exception {
        final char[] typecodes = {'B', 'C', 'D', 'F', 'I', 'J', 'S', 'Z'};
        char typecode = typecodes[rnd.nextInt(typecodes.length)];

        switch (typecode) {
            case 'B':
                final byte b = Randomizer.nextByte(rnd);
                oos.writeByte(b);
                outExpected.write(typecode + ToJS.toJs(b) + '\n');
                break;
            case 'C':
                final char c = Randomizer.nextChar(rnd);
                oos.writeChar(c);
                outExpected.write(typecode + ToJS.toJs(c) + '\n');
                break;
            case 'D':
                final double d = Randomizer.nextDouble(rnd);
                oos.writeDouble(d);
                outExpected.write(typecode + ToJS.toJs(d) + '\n');
                break;
            case 'F':
                final float f = Randomizer.nextFloat(rnd);
                oos.writeFloat(f);
                outExpected.write(typecode + ToJS.toJs(f) + '\n');
                break;
            case 'I':
                final int i_ = Randomizer.nextInt(rnd);
                oos.writeInt(i_);
                outExpected.write(typecode + ToJS.toJs(i_) + '\n');
                break;
            case 'J':
                final long l = Randomizer.nextLong(rnd);
                oos.writeLong(l);
                outExpected.write(typecode + ToJS.toJs(l) + '\n');
                break;
            case 'S':
                final short s = Randomizer.nextShort(rnd);
                oos.writeShort(s);
                outExpected.write(typecode + ToJS.toJs(s) + '\n');
                break;
            case 'Z':
                final boolean z = Randomizer.nextBoolean(rnd);
                oos.writeBoolean(z);
                outExpected.write(typecode + ToJS.toJs(z) + '\n');
                break;
            default:
                throw new Exception("Unexpected typecode: " + typecode);
        }
    }

    static class A implements Serializable {
        byte b;
        char c;
        double d;
        float f;
        int i;
        long j;
        short s;
        boolean z;
    }

    static void writeObject(Random rnd, FileWriter outExpected, ObjectOutputStream oos) throws Exception {
        A obj = new A();
        obj.b = Randomizer.nextByte(rnd);
        obj.c = Randomizer.nextChar(rnd);
        obj.d = Randomizer.nextDouble(rnd);
        obj.f = Randomizer.nextFloat(rnd);
        obj.i = Randomizer.nextInt(rnd);
        obj.j = Randomizer.nextLong(rnd);
        obj.s = Randomizer.nextShort(rnd);
        obj.z = Randomizer.nextBoolean(rnd);

        outExpected.write("L" + ToJS.toJs(obj) + "\n");
        oos.writeObject(obj);
    }

    static interface GenMethod { void test(ObjectOutputStream oos) throws Exception; }
    static void withOos(String filename, GenMethod test) throws Exception {
        final FileOutputStream outSerialized = new FileOutputStream(PATH_DIR + "/" + filename + ".ser");
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);
        test.test(oos);
        oos.close();
        outSerialized.close();
    }

    static void genPrimitives(ObjectOutputStream oos) throws Exception {
        oos.writeByte(69);
        oos.writeChar('✔');
        oos.writeDouble(420e69);
        oos.writeFloat(-9e30f);
        oos.writeInt(420 * 69);
        oos.writeLong(420L << (6*9));
        oos.writeShort(-12345);
        oos.writeBoolean(true);
    }

    static void genFloats(ObjectOutputStream oos) throws Exception {
        oos.writeFloat(0.5f);
        oos.writeFloat(1_000_000f);
        oos.writeFloat(0.0f);
        oos.writeFloat(-0.0f);
        oos.writeFloat(Float.POSITIVE_INFINITY);
        oos.writeFloat(Float.NEGATIVE_INFINITY);
        oos.writeFloat(Float.NaN);
        oos.writeFloat(1e-40f);

        oos.writeDouble(0.5d);
        oos.writeDouble(1_000_000d);
        oos.writeDouble(0.0d);
        oos.writeDouble(-0.0d);
        oos.writeDouble(Double.POSITIVE_INFINITY);
        oos.writeDouble(Double.NEGATIVE_INFINITY);
        oos.writeDouble(Double.NaN);
        oos.writeDouble(1e-310d);
    }

    static void genIntLimits(ObjectOutputStream oos) throws Exception {
        oos.writeByte(-1);
        oos.writeByte(0);
        oos.writeByte(1);
        oos.writeByte(Byte.MIN_VALUE);
        oos.writeByte(Byte.MAX_VALUE);

        oos.writeChar(0);
        oos.writeChar(Character.MIN_VALUE);
        oos.writeChar(Character.MAX_VALUE);
        oos.writeChar(Character.MIN_LOW_SURROGATE);
        oos.writeChar(Character.MAX_LOW_SURROGATE);
        oos.writeChar(Character.MIN_HIGH_SURROGATE);
        oos.writeChar(Character.MAX_HIGH_SURROGATE);

        oos.writeInt(-1);
        oos.writeInt(0);
        oos.writeInt(1);
        oos.writeInt(Integer.MIN_VALUE);
        oos.writeInt(Integer.MAX_VALUE);

        oos.writeLong(-1L);
        oos.writeLong(0L);
        oos.writeLong(1L);
        oos.writeLong(Long.MIN_VALUE);
        oos.writeLong(Long.MAX_VALUE);

        oos.writeShort(-1);
        oos.writeShort(0);
        oos.writeShort(1);
        oos.writeShort(Short.MIN_VALUE);
        oos.writeShort(Short.MAX_VALUE);
    }

    static void genPrimitiveWrappers(ObjectOutputStream oos) throws Exception {
        oos.writeObject((Byte     )(byte   )5);
        oos.writeObject((Character)(char   )5);
        oos.writeObject((Double   )(double )5);
        oos.writeObject((Float    )(float  )5);
        oos.writeObject((Integer  )(int    )5);
        oos.writeObject((Long     )(long   )5);
        oos.writeObject((Short    )(short  )5);
        oos.writeObject((Boolean  )(boolean)true);
    }

    static void genStrings(ObjectOutputStream oos) throws Exception {
        // A string of all utf-16 char codes in order (0x0000-0xffff)
        String gigaString = IntStream
            .rangeClosed(0, 0xffff)
            .mapToObj(i -> String.valueOf((char)i))
            .collect(Collectors.joining());

        oos.writeObject("");
        oos.writeObject("\0");
        oos.writeObject("a".repeat(0xffff));    // Longest TC_STRING
        oos.writeObject("b".repeat(0xffff+1));  // Shortest TC_LONGSTRING
        oos.writeObject(gigaString);
    }

    static class IntAndObj implements Serializable {
        int i;
        Object obj;
        IntAndObj(int i, Object obj) {this.i = i; this.obj = obj;}
    }
    static void genArrays(ObjectOutputStream oos) throws Exception {
        // Empty array
        oos.writeObject(new boolean[]{});

        // Array of all possible byte values
        byte[] allBytes = new byte[Byte.MAX_VALUE - Byte.MIN_VALUE + 1];
        for (int i=Byte.MIN_VALUE; i<=Byte.MAX_VALUE; i++) {
            allBytes[i - Byte.MIN_VALUE] = (byte)i;
        }
        oos.writeObject(allBytes);

        // 2d array
        oos.writeObject(new int[][]{{1,2,3}, {4,5,6}, {7,8,9}});

        // Array of interconnected objects
        IntAndObj a = new IntAndObj(1, null);
        IntAndObj b = new IntAndObj(2, a);
        IntAndObj c = new IntAndObj(3, b);
        oos.writeObject(new IntAndObj[]{a,b,c});
    }

    static class EmptyClass implements Serializable {}
    static void genObjRef(ObjectOutputStream oos) throws Exception {
        EmptyClass obj1 = new EmptyClass();
        EmptyClass obj2 = new EmptyClass();
        oos.writeObject(obj1);
        oos.writeObject(obj2);
        oos.writeObject(obj1);
        oos.writeObject(obj2);

        oos.reset();
        oos.reset();
        oos.reset();

        oos.writeObject(obj1);
    }

    interface ThrowingRunnable {void run() throws Exception;}
    static void genBlockEdgeCases(String filename) throws Exception {
        final FileOutputStream outSerialized = new FileOutputStream(PATH_DIR + "/" + filename + ".ser");
        final ObjectOutputStream oos = new ObjectOutputStream(outSerialized);

        // Reflection voodoo to expose bout.setBlockDataMode
        Field boutF = ObjectOutputStream.class.getDeclaredField("bout");
        boutF.setAccessible(true);
        Object bout = boutF.get(oos);
        Method setBlockDataMode = bout.getClass().getDeclaredMethod("setBlockDataMode", boolean.class);
        setBlockDataMode.setAccessible(true);

        // Force blocks to start / end. Must edit underlying stream to force an empty block.
        ThrowingRunnable startBlock = () -> {setBlockDataMode.invoke(bout, true);};
        ThrowingRunnable endBlock = () -> {setBlockDataMode.invoke(bout, false); oos.flush();};
        ThrowingRunnable emptyBlock = () -> {endBlock.run(); outSerialized.write(new byte[]{0x77, 0x00}); outSerialized.flush();};

        // Write an int (0xdefaced) across 6 blocks ([][0d][][][ef ac][ed])
        emptyBlock.run();
        startBlock.run(); oos.writeByte(0x0d); endBlock.run();
        emptyBlock.run();
        emptyBlock.run();
        startBlock.run(); oos.writeByte(0xef); oos.writeByte(0xac); endBlock.run();
        startBlock.run(); oos.writeByte(0xed); endBlock.run();

        // Write objects with empty blocks between them
        oos.writeObject(new EmptyClass());
        emptyBlock.run();
        emptyBlock.run();
        emptyBlock.run();
        oos.writeObject(new EmptyClass());

        oos.close();
        outSerialized.close();
    }

    static void genCircular(ObjectOutputStream oos) throws Exception {
        IntAndObj obj = new IntAndObj(5, null);
        obj.obj = obj;
        oos.writeObject(obj);
    }

    static class SerNoW implements Serializable {
        int i; SerNoW(int i) {this.i = i;}
    }
    static class SerW implements Serializable {
        int i; SerW(int i) {this.i = i;}
        private void writeObject(ObjectOutputStream out) throws IOException {out.defaultWriteObject();}
    }
    static class EmptySerW implements Serializable {private void writeObject(ObjectOutputStream out) throws IOException {}}
    static class SerWExtra implements Serializable {
        int i; SerWExtra(int i) {this.i = i;}
        private void writeObject(ObjectOutputStream out) throws IOException {
            out.defaultWriteObject();
            out.writeObject(new EmptySerW());
        }
    }
    static class SerWNoFields implements Serializable {
        int i; SerWNoFields(int i) {this.i = i;}
        private void writeObject(ObjectOutputStream out) throws IOException {out.writeInt(this.i);}
    }
    static class SerWMisplacedFields implements Serializable {
        int i; SerWMisplacedFields(int i) {this.i = i;}
        private void writeObject(ObjectOutputStream out) throws IOException {
            out.writeInt(123);
            out.defaultWriteObject();
            out.writeInt(456);
        }
    }
    static class ExtParent implements Externalizable {
        public void writeExternal(ObjectOutput out) throws IOException {}
        public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {}
    }
    static class ExtChild extends ExtParent {
        int i; ExtChild(int i) {this.i = i;}
        public void writeExternal(ObjectOutput out) throws IOException {
            out.writeInt(this.i);
            out.writeUTF("testicle");
            out.writeObject(new EmptySerW());
        }
        public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {}
    }
    static void genHandlers(ObjectOutputStream oos) throws Exception {
        oos.writeObject(new SerNoW(1));
        oos.writeObject(new SerW(2));
        oos.writeObject(new SerWExtra(3));
        oos.writeObject(new SerWNoFields(4));
        oos.writeObject(new SerWMisplacedFields(5));
        oos.writeObject(new ExtChild(6));

        // oos.reset();
        // oos.useProtocolVersion(1);
        // oos.writeObject(new ExtChild(7));
    }

    public static void main(String[] args) throws Exception {
        new File(PATH_DIR).mkdirs();

        withOos("primitives", GenerateTests::genPrimitives);
        withOos("floats", GenerateTests::genFloats);
        withOos("int-limits", GenerateTests::genIntLimits);
        withOos("primitive-wrappers", GenerateTests::genPrimitiveWrappers);
        withOos("strings", GenerateTests::genStrings);
        withOos("arrays", GenerateTests::genArrays);
        withOos("obj-ref-vs-eq", GenerateTests::genObjRef);
        genBlockEdgeCases("blocks");
        withOos("circular", GenerateTests::genCircular);
        withOos("handlers", GenerateTests::genHandlers);
    }
}
