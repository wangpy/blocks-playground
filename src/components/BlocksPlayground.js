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
  DropdownItem,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip
} from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.css';

import CodeMirror from 'react-codemirror';
import 'codemirror/lib/codemirror.css';

import './BlocksPlayground.css';
import { BlocksTopology } from '../blocks-sdk/components/BlocksTopology';
import { CodeCatalog } from '../data/CodeCatalog';
import { getLineNumberBaseForCustomCode } from '../blocks-sdk/components/BlocksDevice';

import { Base64 } from 'js-base64';
import * as Clipboard from 'clipboard';

import clippyIcon from '../images/clippy.svg';

require('codemirror/mode/javascript/javascript');

//import UglifyJS from 'uglifyjs-browser'
const UglifyJS = require('uglifyjs-browser');
const Pako = require('pako');
const UrlParse = require('url-parse');
const GoogleURL = require('google-url');

const kGoogleUrlKey = 'AIzaSyCSGiSTfDdc01Tn9Tk83vQ00f6Ag2sCIMI';
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
  isShareDialogOpened: boolean,
  isSharing: boolean,
  isUrlCopied: boolean,
  lastCodeUpdateTime: ?Date,
  urlToShare: string,
  codeError: *,
  executionError: *,
}

export class BlocksPlayground extends React.Component<Props, State> {
  _clipboard: *;
  _codeCatalog: CodeCatalog;
  _codeMirror: *;
  _localStorage: *;

  constructor(props: Props) {
    super(props);
    this._clipboard = null;
    this._codeCatalog = new CodeCatalog();
    this._codeMirror = null;
    this._localStorage = window.localStorage;
    this.state = {
      code: this.getDefaultCode(),
      minifiedCode: '',
      enabled: true,
      isNavbarItemsOpen: false,
      isSavedToDraft: false,
      isShareDialogOpened: false,
      isSharing: false,
      isUrlCopied: false,
      lastCodeUpdateTime: null,
      urlToShare: null,
      codeError: null,
      executionError: null
    };
  }

  getDefaultCode() {
    const parsedUrl = UrlParse(window.location.href, true);
    if (parsedUrl.query.code != null) {
      return this.getExtractedCode(parsedUrl.query.code);
    }
    const localCode = this._localStorage.getItem(kLocalStorageKeyForBlocksCodeInEditor);
    if (localCode != null) {
      return localCode;
    }
    return this._codeCatalog.getEmptyTemplate();
  }

  getCompressedCode(code: string): string {
    const binaryString = Pako.deflate(code, { to: 'string' });
    return Base64.encode(binaryString);
  }

  getExtractedCode(base64code: string): string {
    const binaryString = Base64.decode(base64code);
    return Pako.inflate(binaryString, { to: 'string' });
  }

  minifyCode(code: string): ?string {
    try {
      let ast = UglifyJS.parse(code)
      ast.figure_out_scope()
      const compressor = UglifyJS.Compressor()
      ast = ast.transform(compressor)

      ast.figure_out_scope()
      ast.compute_char_frequency()
      ast.mangle_names()

      const minified = ast.print_to_string()
      return minified;
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
        isShareDialogOpened: false,
        isSharing: false,
        urlToShare: null,
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

  handleShareButtonClick = () => {
    if (this.state.urlToShare != null) {
      this.setState({ isShareDialogOpened: true });
      return;
    }

    const base64Code = this.getCompressedCode(this.state.code);
    const parsedUrl = UrlParse(window.location.href);
    parsedUrl.set('query', { code: base64Code });
    const urlToShare = parsedUrl.toString();

    this.setState({ isSharing: true });

    const googleUrl = new GoogleURL({ key: kGoogleUrlKey });
    googleUrl.shorten(urlToShare, (err, shortUrl) => {
      if (err) {
        console.error('Shorten URL error', err, urlToShare);
        shortUrl = urlToShare;
      }
      this.setState({
        isShareDialogOpened: true,
        isSharing: false,
        urlToShare: shortUrl
      });
    });
  };

  handleToggleShareModalDialog = () => {
    this.setState({
      isShareDialogOpened: false,
      isUrlCopied: false,
    });
  }

  componentDidMount() {
    this.checkAndDeployCustomCode(this.getDefaultCode());
    this._clipboard = new Clipboard("#share-btn");
    this._clipboard.on('success', () => {
      this.setState({ isUrlCopied: true });
    });
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

  renderCodeDeployStatusBar() {
    const enabled = this.state.enabled;
    return (
      <div className="blocks-playground-code-deploy-status">
        <Button
          color={enabled ? 'success' : 'warning'}
          size="sm"
          onClick={this.handleToggleButtonClick}>
          Status: {enabled ? 'Enabled' : 'Disabled'}
        </Button>
        {this.renderCustomCodeDeployStatus()}
        {(this.state.lastCodeUpdateTime != null) ? (
          <span>
            <Button
              color={this.state.isSavedToDraft ? 'secondary' : 'info'}
              outline={this.state.isSavedToDraft}
              size="sm"
              onClick={this.handleSaveDraftButtonClick}>
              {(!this.state.isSavedToDraft) ? 'Save to Draft' : 'Saved to draft'}
            </Button>
            <Button
              color={this.state.isSharing ? 'secondary' : 'light'}
              outline={this.state.isSharing}
              size="sm"
              onClick={this.handleShareButtonClick}>
              {(!this.state.isSharing) ? 'Share Your Code!' : 'Generating Link...'}
            </Button>
          </span>
        ) : null}
      </div>
    );
  }

  renderShareModalDialog() {
    return (
      <Modal
        isOpen={this.state.isShareDialogOpened}
        toggle={this.handleToggleShareModalDialog}
        className="share-modal-dialog">
        <ModalHeader toggle={this.handleToggleShareModalDialog}>Share Your Code</ModalHeader>
        <ModalBody>
          <div>
            Share Link:
            <input id="share-url" value={this.state.urlToShare} />
            <button id="share-btn" data-clipboard-text={this.state.urlToShare}>
              <img src={clippyIcon} alt="Copy to Clipboard" />
            </button>
            <Tooltip
              placement="bottom"
              isOpen={this.state.isUrlCopied} target="share-btn"
              toggle={() => this.setState({ isUrlCopied: false })}>
              Copied!
            </Tooltip>
          </div>
          <div style={{ marginTop: 5 }}>
            <a href={kFeedbackFormURL} target="_blank">You can also submit your code to our Code Catalog!</a>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="secondary" onClick={this.handleToggleShareModalDialog}>Close</Button>
        </ModalFooter>
      </Modal >
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
            {this.renderCodeDeployStatusBar()}
          </div>
        </div>
        {this.renderShareModalDialog()}
      </div >
    );
  }
}

export default BlocksPlayground;