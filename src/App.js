// @flow

import * as React from 'react';
import './App.css';
import { BlocksPlayground } from './components/BlocksPlayground';

type Props = {
};

type State = {
}

class App extends React.Component<Props, State> {
  componentDidMount() {
    document.title = "BLOCKS Playground";
  }

  render() {
    return (
      <BlocksPlayground />
    );
  }
}

export default App;
