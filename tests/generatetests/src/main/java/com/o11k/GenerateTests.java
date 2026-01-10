package com.o11k;

import java.io.*;
import java.lang.reflect.*;
import java.util.stream.*;


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

        oos.reset();
        oos.useProtocolVersion(1);
        oos.writeObject(new ExtChild(7));
    }

    static class SerWithChildObjA implements Serializable {
        Object child;
        SerWithChildObjA(Object child) {this.child = child;}
    }
    static class SerWithChildObjB implements Serializable {
        Object child;
        SerWithChildObjB(Object child) {this.child = child;}
    }
    static void genResolveShenanigans(ObjectOutputStream oos) throws Exception {
        SerWithChildObjA a = new SerWithChildObjA(null);
        SerWithChildObjB b = new SerWithChildObjB(null);
        a.child = b;
        b.child = a;
        oos.writeObject(a);
        oos.writeObject(b);
    }

    // More than one reset at beginning, end, between blockdata->obj, obj->data, data->data, obj->obj
    static void genResets(ObjectOutputStream oos) throws Exception {
        oos.reset(); oos.reset();
        oos.writeLong(0x6969696969696969L);
        oos.reset(); oos.reset();
        oos.writeLong(0x6969696969696969L);
        oos.reset(); oos.reset();
        oos.writeObject(new EmptyClass());
        oos.reset(); oos.reset();
        oos.writeObject(new EmptyClass());
        oos.reset(); oos.reset();
        oos.writeLong(0x6969696969696969L);
        oos.reset(); oos.reset();
    }

    static class SerParent implements Serializable {
        int parentField;
        SerParent(int field) {parentField = field;}
    }
    static class SerChild extends SerParent {
        int childField;
        SerChild(int pField, int cField) {
            super(pField);
            childField = cField;
        }
    }
    static void genSerializableInheritence(ObjectOutputStream oos) throws Exception {
        oos.writeObject(new SerChild(5,5));
        oos.writeObject(new SerParent(5));
    }


    static void genExternalizable(ObjectOutputStream oos) throws Exception {
        oos.writeObject(new ExtChild(5));
        oos.reset();
        oos.useProtocolVersion(ObjectOutputStream.PROTOCOL_VERSION_1);
        oos.writeObject(new ExtChild(5));
        oos.write(new byte[]{1,1,1,1,1,1,1,1,1,1,1,1,1,1});
    }

    static void genClasses(ObjectOutputStream oos) throws Exception {
        oos.writeObject(SerNoW.class);
        oos.writeObject(SerW.class);
        oos.writeObject(SerWExtra.class);
        oos.writeObject(SerWNoFields.class);
        oos.writeObject(SerWMisplacedFields.class);
        oos.writeObject(ExtParent.class);
        oos.writeObject(ExtChild.class);
    }

    static void genClassDescs(ObjectOutputStream oos) throws Exception {
        oos.writeObject(ObjectStreamClass.lookup(SerNoW.class));
        oos.writeObject(ObjectStreamClass.lookup(SerW.class));
        oos.writeObject(ObjectStreamClass.lookup(SerWExtra.class));
        oos.writeObject(ObjectStreamClass.lookup(SerWNoFields.class));
        oos.writeObject(ObjectStreamClass.lookup(SerWMisplacedFields.class));
        oos.writeObject(ObjectStreamClass.lookup(ExtParent.class));
        oos.writeObject(ObjectStreamClass.lookup(ExtChild.class));
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
        withOos("resolve", GenerateTests::genResolveShenanigans);
        withOos("resets", GenerateTests::genResets);
        withOos("ser-extends", GenerateTests::genSerializableInheritence);
        withOos("externalizable", GenerateTests::genExternalizable);
        withOos("classes", GenerateTests::genClasses);
        withOos("classdescs", GenerateTests::genClassDescs);
    }
}
