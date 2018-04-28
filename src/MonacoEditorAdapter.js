import { isEmpty } from "lodash";
import { TextOperation } from "./lib";
import { addStyleRule, multiline } from "./helper";

addStyleRule(multiline`
  .my-cursor {
    background: #ff004f;
    width: 2px !important;
  }
  .my-range {
    background-color: green;
  }
`);

function isSelectedSomthing(selection) {
  const { startColumn, endColumn, startLineNumber, endLineNumber } = selection;
  return startColumn === endColumn && startLineNumber === endLineNumber;
}

function getRemovedText(change, doc) {
  const { rangeLength, rangeOffset } = change;
  return [doc.substring(rangeOffset, rangeLength + rangeOffset)];
}

function isRange(selection) {
  const { startLineNumber, startColumn, endLineNumber, endColumn } = selection;
  if (startLineNumber !== endLineNumber || startColumn !== endColumn)
    return true;
  return false;
}

class MonacoEditorAdapter {
  operationFromMonacoChanges(changes) {
    let docLength = window.editor.getModel().getValueLength();
    let operation = new TextOperation().retain(docLength);
    let inverse = new TextOperation().retain(docLength);
    for (let i = changes.length - 1; i >= 0; i -= 1) {
      const change = changes[i];

      const restLength = docLength - change.rangeOffset - change.text.length;
      operation = new TextOperation()
        .retain(change.rangeOffset)
        .delete(change.rangeLength)
        .insert([change.text].join("\n"))
        .retain(restLength)
        .compose(operation);
      const removed = getRemovedText(change, this.documentBeforeChanged);
      console.log(`${removed} has been removed!!!!`);
      inverse = inverse.compose(
        new TextOperation()
          .retain(change.rangeOffset)
          .delete(change.text.length)
          .insert(removed.join("\n"))
          .retain(restLength)
      );
      docLength += removed.length - change.text.length;
    }
    this.documentBeforeChanged = this.editor.getValue();
    return [operation, inverse];
  }

  static applyOperationToMonaco(operation, editor) {
    const textModel = editor.getModel();
    let range = {
      startLineNumber: 0,
      startColumn: 0,
      endLineNumber: 0,
      endColumn: 0
    };
    let text = "";
    let forceMoveMarkers = false;
    let hasHead = false;
    let insertOffset = 0;
    let afterOffset = 0;
    console.log(operation.ops);
    const ops = operation.ops;
    const operationsForEditor = [];

    for (let i = 0, l = ops.length; i < l; i += 1) {
      let op = ops[i];
      if (TextOperation.isRetain(op)) {
        if (!hasHead) {
          insertOffset = op;
          const { lineNumber, column } = textModel.getPositionAt(op);
          console.log('插入： ', lineNumber, column)
          range = {
            ...range,
            startLineNumber: lineNumber,
            startColumn: column
          };
        } else {
          afterOffset = op;
        }
        hasHead = true;
      } else if (TextOperation.isInsert(op)) {
        text = op;
        insertOffset += op.length;
        range = {
          ...range,
          endLineNumber: range.startLineNumber,
          endColumn: range.startColumn
        };
      } else if (TextOperation.isDelete(op)) {
        const { lineNumber, column } = textModel.getPositionAt(insertOffset - op);
        console.log('删除', lineNumber, column);
        range = {
          ...range,
          endLineNumber: lineNumber,
          endColumn: column,
        };
      }
    }
    console.log({
      text,
      range,
      forceMoveMarkers,
      identifier: "ot-change"
    });
    operationsForEditor.push({
      text,
      range,
      forceMoveMarkers,
      identifier: "ot-change"
    });
    textModel.pushEditOperations([], operationsForEditor);
  }

  callback = params => {
    console.log(params);
  };

  constructor(editor) {
    this.ignoreNextChange = false;
    this.changeInProgress = false;
    this.selectionChanged = false;
    this.editor = editor;
    this.oldDecorations = [];
    this.oldInlineDecorations = [];
    this.documentBeforeChanged = this.editor.getValue() || ''
    this.oldContentWidget = {
      getDomNode: () => null,
      getId: () => "",
      getPosition: () => ({
        position: { lineNumber: 0, column: 0 },
        preference: [
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
          monaco.editor.ContentWidgetPositionPreference.BELOW
        ]
      })
    };

    editor.onDidChangeModelContent(this.onChange);
    editor.onDidFocusEditor(this.onFocus);
    editor.onDidBlurEditor(this.onBlur);
    editor.onDidChangeCursorSelection(this.onFocus);
  }

  onChange = e => {
    const { changes } = e;
    if (!this.ignoreNextChange) {
      const pair = this.operationFromMonacoChanges(
        changes,
        this.editor
      );
      this.trigger("change", pair[0], pair[1]);
    }

    if (this.selectionChanged) {
      this.trigger("selectionChange");
    }

    this.changeInProgress = false;
    this.ignoreNextChange = false;
  };

  onFocus = () => {
    if (this.changeInProgress) {
      this.selectionChanged = true;
    } else {
      this.trigger("selectionChange");
    }
  };

  onBlur = () => {
    const selection = this.editor.getSelection();
    if (!isSelectedSomthing(selection)) this.trigger("blur");
  };

  detach = () => {};

  registerCallbacks = cb => {
    this.callbacks = cb;
  };

  getValue = () => {
    return this.editor.getValue();
  };

  getSelection = () => {
    return this.editor.getSelection();
  };

  setSelection = selection => {
    this.editor.setSelection(selection);
  };

  setOtherCursorAndRange = (selection, hue, name) => {
    const {
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn
    } = selection;
    const temp = this.oldDecorations;
    if (selection.ranges) return false;
    this.oldDecorations = this.editor.deltaDecorations(temp, [
      {
        range: new monaco.Range(
          startLineNumber,
          startColumn,
          endLineNumber,
          endColumn
        ),
        options: { className: "my-cursor" }
      }
    ]);
    this.editor.removeContentWidget(this.oldContentWidget);
    this.setOtherUserName(selection, hue, name);

    if (!isRange(selection)) {
      this.oldInlineDecorations = this.editor.deltaDecorations(
        this.oldInlineDecorations,
        []
      );
    } else {
      const inlineDecorations = {
        range: new monaco.Range(
          startLineNumber,
          startColumn,
          endLineNumber,
          endColumn
        ),
        options: { inlineClassName: "my-range" }
      };
      const temp = this.oldInlineDecorations;
      this.oldInlineDecorations = this.editor.deltaDecorations(temp, [
        inlineDecorations
      ]);
    }
  };

  setOtherUserName = (selection, hue, name) => {
    this.editor.removeContentWidget(this.oldContentWidget);
    const { endLineNumber, endColumn } = selection;
    this.oldContentWidget = {
      getId: () => name,
      getDomNode: () => {
        const p = document.createElement("p");
        p.style.backgroundColor = "#ff004f";
        p.style.fontSize = "12px";
        p.innerHTML = name;
        p.style.margin = "0px !important";
        return p;
      },
      getPosition: () => ({
        position: {
          lineNumber: endLineNumber,
          column: endColumn
        },
        preference: [
          monaco.editor.ContentWidgetPositionPreference.ABOVE,
          monaco.editor.ContentWidgetPositionPreference.BELOW
        ]
      })
    };
    this.editor.addContentWidget(this.oldContentWidget);
  };

  setOtherSelection = (selection, hue, name) => {
    if (isEmpty(selection)) return;

    this.setOtherCursorAndRange(selection, hue, name);
  };

  trigger = (event, ...args) => {
    const action = this.callbacks && this.callbacks[event];
    if (action) action.apply(this, args);
  };

  applyOperation = operation => {
    this.ignoreNextChange = true;
    MonacoEditorAdapter.applyOperationToMonaco(operation, this.editor);
  };

  registerUndo = undoFn => {
    // todo
  };

  registerRedo = redoFn => {
    //  todo
  };
}

export default MonacoEditorAdapter;
