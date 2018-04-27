import ot from "ot";
import { isEmpty } from 'lodash';
import TextOperation from "./TextOperation";
import { addStyleRule, multiline } from './helper';


addStyleRule(multiline`
  .my-cursor {
    background: #ff004f;
    width: 2px !important;
  }
`);

// const TextOperation = ot.TextOperation;

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
  if (startLineNumber !== endLineNumber || startColumn !== endColumn) return true;
  return false;
}

class MonacoEditorAdapter {
  static operationFromMonacoChanges(changes) {
    let docLength = window.editor.getModel().getValueLength();
    let operation = new TextOperation().retain(docLength);
    let inverse = new TextOperation().retain(docLength);
    for (let i = changes.length - 1; i >= 0; i -= 1) {
      const change = changes[i];

      const restLength =
        docLength - change.rangeOffset - change.text.length;
        debugger
      operation = new TextOperation()
        .retain(change.rangeOffset)
        ["delete"](change.rangeLength)
        .insert([change.text].join('\n'))
        .retain(restLength)
        .compose(operation);
      const removed = getRemovedText(change, window.editor.getValue());
      inverse = inverse.compose(
        new TextOperation()
          .retain(change.rangeOffset)
          ["delete"](change.text.length)
          .insert(removed.join('\n'))
          .retain(restLength)
      );
      docLength += removed.length - change.text.length;
    }

    return [operation, inverse];
  }

  static applyOperationToMonaco(operation, editor) {
    const textModel = editor.getModel();
    let range = {
      startLineNumber: 0,
      startColumn: 0,
      endLineNumber: 0,
      endColumn: 0,
    };
    let text = "";
    let forceMoveMarkers = false;
    let hasHead = false;

    const ops = operation.ops;
    const operationsForEditor = [];

    for (let i = 0, l = ops.length; i < l; i += 1) {
      let op = ops[i];
      if (TextOperation.isRetain(op)) {
        if (!hasHead) {
          const { lineNumber, column } = textModel.getPositionAt(op);
          range = { ...range, startLineNumber: lineNumber, startColumn: column };
        }
        hasHead = true;
      } else if (TextOperation.isInsert(op)) {
        text = op;
        range = {
          ...range,
          endLineNumber: range.startLineNumber,
          endColumn: range.startColumn,
        };
      } else if (TextOperation.isDelete(op)) {
        const { lineNumber, column } = textModel.getPositionAt(op);
        range = { ...range, endLineNumber: range.startLineNumber, endColumn: range.startColumn + op + 1};
      }
    }

    operationsForEditor.push({
      text,
      range,
      forceMoveMarkers,
      identifier: 'ot-change',
    })
    textModel.pushEditOperations([], operationsForEditor);
  }

  callback = (params) => {
    console.log(params);
  }

  constructor(editor) {
    this.ignoreNextChange = false;
    this.changeInProgress = false;
    this.selectionChanged = false;
    this.editor = editor;
    this.oldDecorations = [];
    this.oldContentWidget = {
      getDomNode: () => null,
      getId: () => '',
      getPosition: () => ({
        position: { lineNumber: 0, column: 0 },
        preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW]
      })
    }

    editor.onDidChangeModelContent(this.onChange);
    editor.onDidFocusEditor(this.onFocus);
    editor.onDidBlurEditor(this.onBlur);
    editor.onDidChangeCursorSelection(this.onFocus);
  }

  onChange = e => {
    const { changes } = e;
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

  setOtherCursor = (selection, hue, name) => {
    const { startLineNumber, startColumn, endLineNumber, endColumn } = selection;
    const temp = this.oldDecorations;
    this.oldDecorations = this.editor.deltaDecorations(temp, [
      {
        range: new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn),
        options: { className: 'my-cursor' },
      }
    ]);
    this.editor.removeContentWidget(this.oldContentWidget);
    this.setOtherUserName(selection, hue, name);
  };

  setOtherUserName = (selection, hue, name) => {
    this.editor.removeContentWidget(this.oldContentWidget);
    const { positionLineNumber, positionColumn } = selection;
    this.oldContentWidget = {
      getId: () => name,
      getDomNode: () => {
        const p = document.createElement('p');
        p.style.backgroundColor = '#ff004f';
        p.style.fontSize = '12px';
        p.innerHTML = name;
        p.style.margin = '0px !important';
        return p;
      },
      getPosition: () => ({
        position: {
          lineNumber: positionLineNumber,
          column: positionColumn,
        },
        preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE, monaco.editor.ContentWidgetPositionPreference.BELOW]
      })
    }
    this.editor.addContentWidget(this.oldContentWidget);
  }

  setOtherSelectionRange = (selection, hue, name) => {
    // if (!this.oldContentWidget) this.oldContentWidget = {};
    
    // console.log(selection);
  };

  setOtherSelection = (selection, hue, name) => {
    if (isEmpty(selection)) return;

    if (isRange(selection)) {
      this.setOtherSelectionRange(selection, hue, name);
    } else {
      this.setOtherCursor(selection, hue, name);
    }
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
