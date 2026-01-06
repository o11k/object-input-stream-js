import type ObjectInputStream from '.';


// ========== CONTRACT ==========
//
// - If a node has children, their spans add up exactly to the parent's span, and do not overlap
// - Handles are consecutive, epoch increments on "reset" or "exception"
// - Types match
//     - ClassDescNode  > PrevObjectNode is a ClassDesc
//     - NewEnumNode    > ObjectNode     is a String
//     - ObjectDescNode > ObjectNode     is a String
//     - ExceptionNode  > ObjectNode     is Throwable
// - "values" match their respective "fields" / array classData


export interface Ast {
    data: Uint8Array
    root: RootNode
}
export default Ast

export type Node =
    RootNode | MagicNode | VersionNode | ContentsNode
  | BlockDataSequenceNode | BlockDataNode
  | PrimitiveNode | UtfNode | LongUtfNode | UtfBodyNode | BytesNode | SkippedNode
  | ObjectNode | TCNode | ClassDescInfoNode | ProxyClassDescInfoNode
  | ClassDataNode | FieldsNode | ValuesNode | FieldDescNode

export interface RootNode extends BaseNode<[MagicNode, VersionNode, ContentsNode]> {
    type: "root"
}

export interface MagicNode extends BaseNode<null>   {type: "magic",   value: typeof ObjectInputStream.STREAM_MAGIC}
export interface VersionNode extends BaseNode<null> {type: "version", value: typeof ObjectInputStream.STREAM_VERSION}

export interface ContentsNode extends BaseNode<(BlockDataSequenceNode | ObjectNode)[]> {
    type: "contents"
}

interface BaseNode<C extends Node[] | null> {
    type: string
    span: {start: number, end: number}
    children: C
    jsValue?: any
}


// ========== Primitives ==========

export type PrimitiveNode = ByteNode | UnsignedByteNode | ShortNode | UnsignedShortNode | IntNode | FloatNode | DoubleNode | CharNode | BooleanNode | LongNode

interface BasePrimitiveNode extends BaseNode<null> {
    type: "primitive"
    dataType: string
    value: number | string | boolean | bigint
}
interface NumberNode extends BasePrimitiveNode {
    dataType: string
    value: number
}
export type ByteNode          = NumberNode & {dataType: "byte"}
export type UnsignedByteNode  = NumberNode & {dataType: "unsigned-byte"}
export type ShortNode         = NumberNode & {dataType: "short"}
export type UnsignedShortNode = NumberNode & {dataType: "unsigned-short"}
export type IntNode           = NumberNode & {dataType: "int"}
export type FloatNode         = NumberNode & {dataType: "float"}
export type DoubleNode        = NumberNode & {dataType: "double"}

export interface CharNode extends BasePrimitiveNode {
    dataType: "char"
    value: string
}
export interface BooleanNode extends BasePrimitiveNode {
    dataType: "boolean"
    value: boolean
}
export interface LongNode extends BasePrimitiveNode {
    dataType: "long"
    value: bigint
}

export interface UtfNode extends BaseNode<[UnsignedShortNode, UtfBodyNode]> {
    type: "utf"
}
export interface LongUtfNode extends BaseNode<[LongNode, UtfBodyNode]> {
    type: "long-utf"
}
export interface UtfBodyNode extends BaseNode<null> {
    type: "utf-body"
    value: string
}

export interface BytesNode extends BaseNode<null> {
    type: "bytes"
}

export interface SkippedNode extends BaseNode<null> {
    type: "skipped"
    reason: string
}


// ========== Block Data ==========

export interface BlockDataSequenceNode extends BaseNode<BlockDataNode[]> {
    type: "blockdata-sequence"
    values: (PrimitiveNode | UtfNode | SkippedNode)[]
}

export interface BlockDataNode extends BaseNode<
[TC_BLOCKDATA_Node,     UnsignedByteNode, BytesNode] |
[TC_BLOCKDATALONG_Node, LongNode,         BytesNode]
> {
    type: "blockdata"
}


// ========== Objects ==========

export type ObjectNode = NewObjectNode | NewClassNode | NewArrayNode | NewStringNode | NewEnumNode | NewClassDescNode | PrevObjectNode | NullNode | ExceptionNode | ResetNode
export type ClassDescNode = NewClassDescNode | NullNode | PrevObjectNode

interface BaseObjectNode<C extends [TCNode, ...Node[]]> extends BaseNode<C> {
    type: "object"
    objectType: string
}

export interface NewObjectNode extends BaseObjectNode<
    [TC_OBJECT_Node, ClassDescNode, ...ClassDataNode[]]
> {
    objectType: "new-object"
    handle: Handle
}
export interface NewClassNode extends BaseObjectNode<[TC_CLASS_Node, ClassDescNode]> {
    objectType: "new-class"
    handle: Handle
}
export interface NewArrayNode extends BaseObjectNode<[TC_ARRAY_Node, ClassDescNode, IntNode, ValuesNode]> {
    objectType: "new-array"
    handle: Handle
}
export interface NewStringNode extends BaseObjectNode<
    [TC_STRING_Node,     UtfNode] |
    [TC_LONGSTRING_Node, LongUtfNode]
> {
    objectType: "new-string"
    handle: Handle
}
export interface NewEnumNode extends BaseObjectNode<[TC_ENUM_Node, ClassDescNode, ObjectNode]> {
    objectType: "new-enum"
    handle: Handle
}
export interface NewClassDescNode extends BaseObjectNode<
    [TC_CLASSDESC_Node, UtfNode, LongNode, ClassDescInfoNode] |
    [TC_PROXYCLASSDESC_Node, ProxyClassDescInfoNode]
> {
    objectType: "new-class-desc"
    handle: Handle
}
export interface PrevObjectNode extends BaseObjectNode<[TC_REFERENCE_Node, IntNode]> {
    objectType: "prev-object"
    value: Handle
}
export interface NullNode extends BaseObjectNode<[TC_NULL_Node]> {
    objectType: "null"
}
export interface ExceptionNode extends BaseObjectNode<[TC_EXCEPTION_Node, ObjectNode]> {
    objectType: "exception"
    exceptionEpoch: number
    newEpoch: number
}
export interface ResetNode extends BaseObjectNode<[TC_RESET_Node]> {
    objectType: "reset"
    newEpoch: number
}

export interface ClassDescInfoNode extends BaseNode<[ByteNode, FieldsNode, ContentsNode, TC_ENDBLOCKDATA_Node, ClassDescNode]> {
    type: "class-desc-info"
}
export interface ProxyClassDescInfoNode extends BaseNode<[IntNode, ...UtfNode[], ContentsNode, TC_ENDBLOCKDATA_Node, ClassDescNode]> {
    type: "proxy-class-desc-info"
}


// ========== Fields & Values ==========

export type ClassDataNode = NoWrClassNode | WrClassNode | ExternalClassNode | OldExternalClassNode

interface BaseClassDataNode<C extends Node[] | null> extends BaseNode<C> {
    type: "class-data"
    classType: string
}
export interface NoWrClassNode extends BaseClassDataNode<[ValuesNode]> {
    classType: "serializable"
    writeMethod: false
}
export interface WrClassNode extends BaseClassDataNode<
    [ValuesNode, ContentsNode] |

    // A write method can choose to violate the spec and write its values late, or not at all.
    // Why? Because fuck you that's why.
    [ContentsNode, ValuesNode, ContentsNode] |
    [ContentsNode, ValuesNode] |
    [ContentsNode]
> {
    classType: "serializable"
    writeMethod: true
}
export interface ExternalClassNode extends BaseClassDataNode<[ContentsNode]> {
    classType: "externalizable"
    protocolVersion: 2
}
export interface OldExternalClassNode extends BaseClassDataNode<(ObjectNode | PrimitiveNode | UtfNode | BytesNode)[]> {
    classType: "externalizable"
    protocolVersion: 1
}

export interface FieldsNode extends BaseNode<[ShortNode, ...FieldDescNode[]]> {
    type: "fields"
}
export interface ValuesNode extends BaseNode<(PrimitiveNode | ObjectNode)[]> {
    type: "values"
}

export type FieldDescNode = PrimitiveDescNode | ObjectDescNode
export interface PrimitiveDescNode extends BaseNode<[UnsignedByteNode, UtfNode]> {
    type: "field-desc"
    fieldType: "primitive"
}
export interface ObjectDescNode extends BaseNode<[UnsignedByteNode, UtfNode, ObjectNode]> {
    type: "field-desc"
    fieldType: "object"
}


// ========== Misc. ==========

interface BaseTCNode extends BaseNode<null> {
    type: "tc"
    value: number
}

export type TCNode = TC_NULL_Node | TC_REFERENCE_Node | TC_CLASSDESC_Node | TC_OBJECT_Node | TC_STRING_Node | TC_ARRAY_Node | TC_CLASS_Node | TC_BLOCKDATA_Node | TC_ENDBLOCKDATA_Node | TC_RESET_Node | TC_BLOCKDATALONG_Node | TC_EXCEPTION_Node | TC_LONGSTRING_Node | TC_PROXYCLASSDESC_Node | TC_ENUM_Node

export type TC_NULL_Node           = BaseTCNode & {value: typeof ObjectInputStream.TC_NULL}
export type TC_REFERENCE_Node      = BaseTCNode & {value: typeof ObjectInputStream.TC_REFERENCE}
export type TC_CLASSDESC_Node      = BaseTCNode & {value: typeof ObjectInputStream.TC_CLASSDESC}
export type TC_OBJECT_Node         = BaseTCNode & {value: typeof ObjectInputStream.TC_OBJECT}
export type TC_STRING_Node         = BaseTCNode & {value: typeof ObjectInputStream.TC_STRING}
export type TC_ARRAY_Node          = BaseTCNode & {value: typeof ObjectInputStream.TC_ARRAY}
export type TC_CLASS_Node          = BaseTCNode & {value: typeof ObjectInputStream.TC_CLASS}
export type TC_BLOCKDATA_Node      = BaseTCNode & {value: typeof ObjectInputStream.TC_BLOCKDATA}
export type TC_ENDBLOCKDATA_Node   = BaseTCNode & {value: typeof ObjectInputStream.TC_ENDBLOCKDATA}
export type TC_RESET_Node          = BaseTCNode & {value: typeof ObjectInputStream.TC_RESET}
export type TC_BLOCKDATALONG_Node  = BaseTCNode & {value: typeof ObjectInputStream.TC_BLOCKDATALONG}
export type TC_EXCEPTION_Node      = BaseTCNode & {value: typeof ObjectInputStream.TC_EXCEPTION}
export type TC_LONGSTRING_Node     = BaseTCNode & {value: typeof ObjectInputStream.TC_LONGSTRING}
export type TC_PROXYCLASSDESC_Node = BaseTCNode & {value: typeof ObjectInputStream.TC_PROXYCLASSDESC}
export type TC_ENUM_Node           = BaseTCNode & {value: typeof ObjectInputStream.TC_ENUM}

export type Handle = {epoch: number, handle: number}
