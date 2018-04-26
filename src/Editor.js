import React, { PureComponent } from 'react';
import { render } from 'react-dom';
import io from 'socket.io-client';
import MonacoEditor from '../node_modules/react-monaco-editor/lib/editor';
import './style.css';
import { DiffMatchPatch } from './diff';
import '../node_modules/ot/lib/index';
const ot = require('ot');
// import TextOperation from 'ot/lib/text-operation';
// import SocketIOAdapter from 'ot/lib/socketio-adapter';
import MonacoEditorAdapter from './MonacoEditorAdapter';
// import EditorClient from 'ot/lib/editor-client';
// const diff_match_patch = require('./diff'); 
// import '../node_modules/ot/lib/text-operation';
// import '../node_modules/ot/lib/index';
// const ot = require('ot');
console.log(ot);

const containerStyle = {
  position: 'fixed',
  width: '100%',
  height: '100%',
  left: '0px',
  top: '0px',
  display: 'flex',
  flexDirection: 'column',
};

const editorStyle = {
  flex: 1,
}

class Editor extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      code: `
      `,
      language: 'java',
    }

    this.oldDecorations = [];
  }
  editorDidMount = (editor, monaco) => {
    this._editor = editor;
    window.editor = editor;
    
    this.docLength = this._editor.getValue().length;

    // this._editor.onDidChangeCursorSelection((e) => {
    //   console.log(e);
    // })
    this._editor.focus();

    this.initSocket();

    // this._editor.onDidChangeCursorSelection((e) => {
    //   console.log(e.selection);
    //   // console.log(e);
    //   // if (e.source === 'keyboard') {
    //     const params = {
    //       selection: e.selection,
    //       id: this.socketClient.id,
    //     }
    //     this.visitorSelection = e.selection;
    //     this.socketClient.emit('selectionUpdate', params);
    //   // }
    // });

    // this._editor.onDidChangeModelContent((e) => {
    //   // console.log(e);
    //   const operation = this.operationFromMonacoChanges(e.changes);
    //   // this.docLength = this._editor.getValue().length;
    //   // console.log(operation);
    // });

    // this.socketClient.on('frent-selection-update', (params) => {
    //   if (params.id !== this.socketClient.id) {
    //     this.visitorSelection = { ...params.selection, id: params.id };
    //     this.updateEditorSelection();
    //   }
    // });
  }

  onChange = (newValue, e) => {
    // const operations = this.operationFromMonacoChanges(e.changes);
    // console.log(e);
    // const data = {
    //   e,
    //   newValue,
    // };
    // this.socketClient.emit('fileUpdate', { id: this.socketClient.id, data, newValue });
  }

  operationFromMonacoChanges (changes) {
    const docLength = this._editor.getValue().length;
    let operation = new TextOperation().retain(docLength);
    let inverse = new TextOperation().retain(docLength)
    for(let i = changes.length - 1; i >= 0; i -= 1) {
      const change = changes[i];

      const restLength = docLength - (change.rangeOffset + 1) - change.text.length;
      operation = new TextOperation()
        .retain(change.rangeOffset + 1)
        ['delete'](change.rangeLength === 0 ? '' : change.text)
        .insert(change.text)
        .retain(restLength)
        .compose(operation);

      inverse = new TextOperation()
        .retain(change.rangeOffset + 1)
        ['delete'](change.rangeLength === 0 ? change.text : '')
        .insert(change.rangeLength === 0 ? '' : change.text)
        .retain(restLength);
    }
    return [operation, inverse];
  }

  initSocket = () => {
    const url = 'http://192.168.0.233:8848/';
    this.socketClient = io(url);

    this.socketClient.on('doc', (data) => {
      this._editor.setValue(data.str);
      const serverAdapter = new ot.SocketIOAdapter(this.socketClient);
      const editorAdapter = new MonacoEditorAdapter(this._editor);
      const client = new ot.EditorClient(data.revision, data.clients, serverAdapter, editorAdapter);
    })
    // this.socketClient.on('sys-msg', (msg) => {
    //   window.alert(msg);
    // });

    // this.socketClient.on('friend-update', (data) => {
    //   if (data.id !== this.socketClient.id) {
    //     this.curPosition = this._editor.getPosition();
    //     this.updateEditor(data.data);
    //   }
    // });
  }

  updateEditor = (editorData) => {
    const { newValue } = editorData;
    const curValue = this._editor.getValue();
    const diffChanges = dmp.diff_main(curValue, newValue);
    const cs = Changeset.fromDiff(diffChanges);
    const applied = cs.apply(curValue);

    const nextModel = monaco.editor.createModel(
      applied,
      this.state.language
    );

    this._editor.setModel(nextModel);
    this._editor.setPosition(this.curPosition);
    // console.log(this.curPosition);
    this._editor.focus();
  }

  updateEditorSelection = () => {
    const { startLineNumber, startColumn, endLineNumber, endColumn } = this.visitorSelection;

    const newDecorations = this._editor.deltaDecorations(this.oldDecorations, [
      {
        range: new monaco.Range(startLineNumber, startColumn, endLineNumber, endColumn),
        options: { className: 'my-cursor' },
      }
    ]);
    this.oldDecorations = newDecorations;
    // this._editor.setSelections([curSelection, this.visitorSelection]);
    // this._editor.focus();
  }

  handleCreateRoom = () => {
    this.socketClient.emit('create-room', this.socketClient.id);

    this.socketClient.on('create-room-suc', (roomID) => {
      this.roomID = roomID;
      window.alert(roomID);
    });
  }

  handleJoinRoom = () => {
    const result = window.prompt('please input roomid');
    if (result !== '') {
      this.socketClient.emit('join', { userId: this.socketClient.id, roomId: result });
    }
  }

  render() {
    const { language, code } = this.state;
    const options = {
      selectOnLineNumbers: true,
      fontFamily: 'monaco',
    };
    return (
      <div>
        <button onClick={this.handleCreateRoom}>开始协同</button>
        <button onClick={this.handleJoinRoom}>加入协同</button>
        <MonacoEditor
          width="800"
          height="600"
          language={language}
          theme="vs-dark"
          value={code}
          options={options}
          onChange={this.onChange}
          editorDidMount={this.editorDidMount}
        />
      </div>
    );
  }
}

const rootEle = document.createElement('div');
document.body.appendChild(rootEle);

render(
  <Editor />,
  rootEle
);
