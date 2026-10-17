import { AppRegistry } from 'react-native';

import App from './App';

AppRegistry.registerComponent('MathTutor', () => App);
// react-native-web mounts into a DOM element; React Native's typings call this a RootTag.
AppRegistry.runApplication('MathTutor', { initialProps: {}, rootTag: document.getElementById('root') as any });
