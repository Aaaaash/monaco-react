import ot from "ot";
import TextOperation from "./TextOperation";

// const TextOperation = ot.TextOperation;

function isSelectedSomthing(selection) {
  const { startColumn, endColumn, startLineNumber, endLineNumber } = selection;
  return startColumn === endColumn && startLineNumber === endLineNumber;
}

function getRemovedText(change, doc) {
  const { rangeLength, rangeOffset } = change;
  return doc.substring(rangeOffset, rangeLength + rangeOffset);
}

function generateRangeFromIndex(op, editor) {
  const sourceValue = editor.getValue();
  const sourceDocArr = sourceValue.split("\n").map(l => l.length + 1);

  let lineNumber = 0;
  let colNumber = op;

  for (let i = 0; i < sourceDocArr.length; i += 1) {
    if (colNumber - sourceDocArr[i] <= 1) {
      lineNumber = i + 1;
      colNumber = colNumber + 1;
      break;
    } else {
      colNumber = colNumber - sourceDocArr[i];
    }
  }
  console.log(lineNumber, colNumber);
  return {
    lineNumber,
    colNumber
  };
}

class MonacoEditorAdapter {
  static operationFromMonacoChanges(changes) {
    let docLength = window.editor.getValue().length;
    let operation = new TextOperation().retain(docLength);
    let inverse = new TextOperation().retain(docLength);
    for (let i = changes.length - 1; i >= 0; i -= 1) {
      const change = changes[i];

      const restLength =
        docLength - change.rangeOffset - change.text.length;
      operation = new TextOperation()
        .retain(change.rangeOffset)
        ["delete"](change.rangeLength)
        .insert(change.text)
        .retain(restLength)
        .compose(operation);

      inverse = inverse.compose(
        new TextOperation()
          .retain(change.rangeOffset)
          ["delete"](change.text.length)
          .insert(
            change.rangeLength === 0
              ? getRemovedText(change, window.editor.getValue())
              : change.text
          )
          .retain(restLength)
      );
      docLength += change.rangeLength - change.text.length;
    }
    console.log(operation, inverse);
    return [operation, inverse];
  }

  static applyOperationToMonaco(operation, editor) {
    const textModel = editor.getModel();
    let range = {};
    let text = "";
    let forceMoveMarkers = false;

    const ops = operation.ops;
    console.log(ops);
    for (let i = 0, l = ops.length; i < l; i += 1) {
      let op = ops[i];
      if (TextOperation.isRetain(op)) {
        if (!range.startLineNumber && !range.startColumn) {
          const { lineNumber, colNumber } = generateRangeFromIndex(op, editor);
          range = {
            ...range,
            startLineNumber: lineNumber,
            startColumn: colNumber
          };
        }
      } else if (TextOperation.isInsert(op)) {
        text = op;
        forceMoveMarkers = true;
        console.log(range);
        range = {
          ...range,
          endLineNumber: range.startLineNumber,
          endColumn: range.startColumn,
        };
      } else if (TextOperation.isDelete(op)) {
        // forceMoveMarkers = false;
        // const { lineNumber, colNumber } = generateRangeFromIndex(op, editor);
        range = { ...range, endLineNumber: range.startLineNumber, endColumn: range.startColumn + op + op };
      }
    }
    debugger
    textModel.pushEditOperations(
      editor.getSelection(),
      [{
        text,
        range,
        forceMoveMarkers
      }],
      this.callback,
    );
    // todo
  }

  callback = (params) => {
    console.log(params);
  }

  constructor(editor) {
    this.ignoreNextChange = false;
    this.changeInProgress = false;
    this.selectionChanged = false;
    this.editor = editor;

    editor.onDidChangeModelContent(this.onChange);
    editor.onDidFocusEditor(this.onFocus);
    editor.onDidBlurEditor(this.onBlur);
  }

  onChange = e => {
    const { changes } = e;
    console.log(changes);
    if (!this.ignoreNextChange) {
      const pair = MonacoEditorAdapter.operationFromMonacoChanges(
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

  setOtherCursor = (position, hue, name) => {};

  setOtherSelectionRange = (range, hue, name) => {};

  setOtherSelection = (selection, hue, name) => {};

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
