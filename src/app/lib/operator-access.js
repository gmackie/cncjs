import controller from './controller';

const key = 'cncjs.operator-session';
export const operatorToken = () => sessionStorage.getItem(key) || '';
export const bindOperator = () => {
  if (controller.socket) {
 controller.socket.emit('operator:bind', operatorToken());
}
};
export const setOperatorToken = token => {
  if (token) {
 sessionStorage.setItem(key, token);
} else {
 sessionStorage.removeItem(key);
}
  bindOperator();
};
controller.addListener('connect', bindOperator);
