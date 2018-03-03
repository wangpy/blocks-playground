// @flow

import * as React from 'react';
import './App.css';
import { BlocksPlayground } from './components/BlocksPlayground';

type Props = {
};

type State = {
}

class App extends React.Component<Props, State> {
  render() {
    return (
      <BlocksPlayground />
    );
  }
}

export default App;
