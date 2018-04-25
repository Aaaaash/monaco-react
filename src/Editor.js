import React, { PureComponent } from 'react';
import { render } from 'react-dom';
import io from 'socket.io-client';
import MonacoEditor from '../node_modules/react-monaco-editor/lib/editor';

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
package com.example.sakura;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SpringBootStartApplication {

  public static void main(String[] args) {
    SpringApplication.run(SpringBootStartApplication.class, args);
  }
}
      `,
      language: 'java',
    }
  }
  editorDidMount = (editor, monaco) => {
    this._editor = editor;
    console.log(monaco);

    // this._editor.onDidChangeCursorSelection((e) => {
    //   console.log(e);
    // })
    this._editor.focus();

    this.initSocket();
  }

  onChange = (newValue, data) => {
    const selection = this._editor.getSelection();
    const selections = this._editor.getSelections();

    this.socketClient.emit('fileUpdate', { id: this.socketClient.id, data });
  }

  initSocket = () => {
    const url = 'http://193.112.25.145:8848/';
    this.socketClient = io(url);

    this.socketClient.on('sys-msg', (msg) => {
      window.alert(msg);
    });

    this.socketClient.on('friend-update', (data) => {
      console.log(this.socketClient.id, data);
    });
  }

  handleAddSelection = () => {
    const newSelection = {
      selectionStartLineNumber: 2,
      selectionStartColumn: 10,
      positionColumn: 10,
      positionLineNumber: 2,
    };
    const curSelections = this._editor.getSelections();
    const selections = [...curSelections, newSelection];

    this._editor.setSelections(selections);
    this._editor.focus();
  }

  handleLoading = () => {
    const code = `
<?php

/*
  * This file is part of the overtrue/laravel-wechat.
  *
  * (c) overtrue <i@overtrue.me>
  *
  * This source file is subject to the MIT license that is bundled
  * with this source code in the file LICENSE.
  */

namespace Overtrue\LaravelWeChat;

use Illuminate\Cache\Repository;
use Psr\SimpleCache\CacheInterface;

class CacheBridge implements CacheInterface
{
    /**
     * @var \Illuminate\Cache\Repository
     */
    protected $repository;

    /**
     * @param \Illuminate\Cache\Repository $repository
     */
    public function __construct(Repository $repository)
    {
        $this->repository = $repository;
    }

    public function get($key, $default = null)
    {
        return $this->repository->get($key, $default);
    }

    public function set($key, $value, $ttl = null)
    {
        return $this->repository->put($key, $value, $this->toMinutes($ttl));
    }

    public function delete($key)
    {
    }

    public function clear()
    {
    }

    public function getMultiple($keys, $default = null)
    {
    }

    public function setMultiple($values, $ttl = null)
    {
    }

    public function deleteMultiple($keys)
    {
    }

    public function has($key)
    {
        return $this->repository->has($key);
    }

    protected function toMinutes($ttl = null)
    {
        if (!is_null($ttl)) {
            return $ttl / 60;
        }
    }
}
    `;

    this.setState({
      code,
      language: 'php'
    });
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
