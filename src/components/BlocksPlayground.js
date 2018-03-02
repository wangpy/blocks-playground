// @flow

import * as React from 'react';
import {
  Button,
  Collapse,
  Navbar,
  NavbarToggler,
  NavbarBrand,
  Nav,
  NavItem,
  NavLink,
  UncontrolledDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem
} from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.css';

import CodeMirror from 'react-codemirror';
import 'codemirror/lib/codemirror.css';

import * as babelPresetMinify from 'babel-preset-minify';
import * as Babel from '@babel/standalone';

import './BlocksPlayground.css';
import { BlocksTopology } from '../blocks-sdk/components/BlocksTopology';
import { CodeCatalog } from '../data/CodeCatalog';
import { getLineNumberBaseForCustomCode } from '../blocks-sdk/components/BlocksDevice';

require('codemirror/mode/javascript/javascript');

const kAboutPageURL = 'https://docs.google.com/document/d/1bIOu8gZJaiQSvcr8YGO_Q699pDe2GB0X7pYtSTPYhgc/edit?usp=sharing';
const kFeedbackFormURL = 'https://goo.gl/forms/Bw8nu2fYjmVWb4pe2';

const kLocalStorageKeyForBlocksCodeInEditor = 'blocksCodeInEditor';
const kLocalStorageKeyForSavedDraft = 'blocksCodeSavedDraft';

type Props = {
};

type State = {
  code: string,
  minifiedCode: string,
  enabled: boolean,
  isNavbarItemsOpen: boolean,
  isSavedToDraft: boolean,
  lastCodeUpdateTime: ?Date,
  codeError: *,
  executionError: *,
}

export class BlocksPlayground extends React.Component<Props, State> {
  _codeCatalog: CodeCatalog;
  _codeMirror: *;
  _localStorage: *;

  constructor(props: Props) {
    super(props);
    this._codeCatalog = new CodeCatalog();
    this._codeMirror = null;
    this._localStorage = window.localStorage;
    this.state = {
      code: this.getDefaultCode(),
      minifiedCode: '',
      enabled: true,
      isNavbarItemsOpen: false,
      isSavedToDraft: false,
      lastCodeUpdateTime: null,
      codeError: null,
      executionError: null
    };
  }

  getDefaultCode() {
    const localCode = this._localStorage.getItem(kLocalStorageKeyForBlocksCodeInEditor);
    const template = this._codeCatalog.getEmptyTemplate();
    return localCode != null ? localCode : template;
  }

  minifyCode(code: string): ?string {
    try {
      return Babel.transform(code, { presets: [babelPresetMinify] }).code;
    } catch (e) {
      console.debug('checkAndDeployCustomCode', 'minify error', e);
      this.setState({
        codeError: e,
        executionError: null,
        lastCodeUpdateTime: null,
      });
      return null;
    }
  }

  checkAndDeployCustomCode(newCode: string, updateEditorContent: boolean = false) {
    const minifiedCode = this.minifyCode(newCode);
    if (minifiedCode == null || minifiedCode === this.state.minifiedCode) {
      return;
    }

    try {
      // eslint-disable-next-line
      eval(newCode);
      this.setState({
        code: newCode + ' ',
        minifiedCode: minifiedCode,
        isSavedToDraft: false,
        lastCodeUpdateTime: new Date(),
        codeError: null,
        executionError: null,
      });
      console.debug('checkAndDeployCustomCode', 'code deployed', minifiedCode);
    } catch (e) {
      console.error('checkAndDeployCustomCode', 'errors in new code', e);
      this.setState({
        codeError: e,
        executionError: null,
        lastCodeUpdateTime: null,
      });
    }

    if (updateEditorContent && this._codeMirror != null) {
      const instance = this._codeMirror.codeMirror;
      instance.doc.setValue(newCode);
    }
  }

  loadEmptyTemplate() {
    const emptyTemplate = this._codeCatalog.getEmptyTemplate();
    this.checkAndDeployCustomCode(emptyTemplate, true);
  }

  loadSampleCode(codeName: string) {
    const sampleCode = this._codeCatalog.getCode(codeName);
    if (sampleCode != null) {
      this.checkAndDeployCustomCode(sampleCode, true);
      this.setState({
        code: sampleCode
      });
    }
  }

  loadSavedDraft() {
    const savedDraft = this._localStorage.getItem(kLocalStorageKeyForSavedDraft);
    if (savedDraft != null) {
      this.checkAndDeployCustomCode(savedDraft, true);
    }
  }

  openAboutPage() {
    window.open(kAboutPageURL);
  }

  openFeedbackForm() {
    window.open(kFeedbackFormURL);
  }

  handleCodeChange = (newCode: string) => {
    this.checkAndDeployCustomCode(newCode);
    this._localStorage.setItem(kLocalStorageKeyForBlocksCodeInEditor, newCode);
    console.debug('code saved to local storage', newCode);
  };

  handleCodeExecutionError = (e: *) => {
    console.error('handleCodeExecutionError', 'execution error', e);
    this.setState({
      codeError: null,
      executionError: e,
      lastCodeUpdateTime: null,
    });
  };

  handleToggleButtonClick = () => {
    const toEnabled = !this.state.enabled;
    this.setState({ enabled: toEnabled });
  };

  handleToggleNavbarItems = () => {
    this.setState({
      isNavbarItemsOpen: !this.state.isNavbarItemsOpen
    });
  };

  handleSaveDraftButtonClick = () => {
    this._localStorage.setItem(kLocalStorageKeyForSavedDraft, this.state.code);
    this.setState({
      isSavedToDraft: true
    });
  };

  componentDidMount() {
    this.checkAndDeployCustomCode(this.getDefaultCode());
  }

  renderCustomCodeDeployStatus() {
    const { lastCodeUpdateTime, codeError, executionError } = this.state;
    if (codeError != null) {
      return (
        <span className="error">
          <b>Error in code:</b> {codeError.toString()}
        </span>
      );
    } else if (executionError != null) {
      const stack = executionError.stack;
      const errorLine = stack.split('\n')[1];
      const errInfo = errorLine.substring(errorLine.indexOf('<anonymous>:') + 12, errorLine.lastIndexOf(')'));
      const errPosArr = errInfo.split(':');
      errPosArr[0] -= getLineNumberBaseForCustomCode();
      errPosArr[1] = parseInt(errPosArr[1], 10);
      const errPos = errPosArr.join(':');
      return (
        <span className="error">
          <b>Error in execution:</b> {executionError.toString()} ({errPos})
        </span>
      );
    } else if (lastCodeUpdateTime) {
      return (
        <span>
          Last code update: {lastCodeUpdateTime.toString()}
        </span>
      );
    }
    return (<span></span>);
  }

  renderCodeSamplesAsDropdownItems() {
    return this._codeCatalog.getCatalog().map(codeName => (
      <DropdownItem key={codeName} onClick={this.loadSampleCode.bind(this, codeName)}>
        {codeName}
      </DropdownItem>
    ));
  }

  renderNavBar() {
    return (
      <Navbar dark expand="md">
        <NavbarBrand href="#">BLOCKS Playground</NavbarBrand>
        <NavbarToggler onClick={this.handleToggleNavbarItems} />
        <Collapse isOpen={this.state.isNavbarItemsOpen} navbar>
          <Nav className="ml-auto" navbar>
            <NavItem onClick={this.loadEmptyTemplate.bind(this)}>
              <NavLink href="#">New</NavLink>
            </NavItem>
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Load
              </DropdownToggle>
              <DropdownMenu right>
                {this.renderCodeSamplesAsDropdownItems()}
                <DropdownItem divider />
                <DropdownItem onClick={this.loadSavedDraft.bind(this)}>
                  Load Saved Draft
                </DropdownItem>
                <DropdownItem divider />
                <DropdownItem onClick={this.openFeedbackForm}>
                  Submit Your Code to Us!
                </DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            <NavItem onClick={this.openAboutPage}>
              <NavLink href="#">Supported APIs</NavLink>
            </NavItem>
            <NavItem onClick={this.openFeedbackForm}>
              <NavLink href="#">Feedback</NavLink>
            </NavItem>
            <NavItem onClick={this.openAboutPage}>
              <NavLink href="#">About</NavLink>
            </NavItem>
          </Nav>
        </Collapse>
      </Navbar>
    );

  }

  render() {
    const enabled = this.state.enabled;
    const codeMirrorOptions = {
      lineNumbers: true,
      lineWrapping: true,
      theme: 'blackboard',
      mode: 'javascript'
    };
    return (
      <div className="blocks-playground-container">
        {this.renderNavBar()}
        <div className="blocks-playground-main-area">
          <div className="blocks-playground-topology-area">
            <BlocksTopology
              enabled={enabled}
              code={this.state.code}
              onCodeExecutionError={this.handleCodeExecutionError} />
          </div>
          <div className="blocks-playground-code-area">
            <CodeMirror
              className="blocks-playground-code-editor"
              value={this.state.code}
              onChange={this.handleCodeChange}
              options={codeMirrorOptions}
              ref={(c) => this._codeMirror = c} />
            <div className="blocks-playground-code-deploy-status">
              <Button
                color={enabled ? 'success' : 'warning'}
                size="sm"
                onClick={this.handleToggleButtonClick}>
                Status: {enabled ? 'Enabled' : 'Disabled'}
              </Button>
              {this.renderCustomCodeDeployStatus()}
              {(this.state.lastCodeUpdateTime != null) ? (
                <Button
                  color={this.state.isSavedToDraft ? 'secondary' : 'info'}
                  outline={this.state.isSavedToDraft}
                  size="sm"
                  onClick={this.handleSaveDraftButtonClick}>
                  {(!this.state.isSavedToDraft) ? 'Save to Draft' : 'Saved to draft'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default BlocksPlayground;