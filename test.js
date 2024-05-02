const TetraController = require('./class/TetraController');

const controller = new TetraController({
    serialPort: 'COM11'
});

controller.on('messageReceived', (message) => {
    if(message.body.length == 0) return;

    console.log(message);
});

controller.on('gps', (message) => {
    console.log(message);
});

// controller.presenceCheck(9015080).then((response) => {
//     console.log(`9015080: ${response}`);
// });
// controller.presenceCheck(9019110).then((response) => {
//     console.log(`9019110: ${response}`);
// });
// controller.presenceCheck(9012113).then((response) => {
//     console.log(`9012113: ${response}`);
// });
// controller.presenceCheck(9012112).then((response) => {
//     console.log(`9012112: ${response}`);
// });
// controller.presenceCheck(9018300).then((response) => {
//     console.log(`9018300: ${response}`);
// });

// const message = controller.sendMessage('', '9019110');

// message.sentPromise.then(() => {
//     console.log('Message sent');
//     console.log(message)
// });

// message.deliveredPromise.then(() => {
//     console.log('Message delivered');
//     console.log(message)
// });

// message.readPromise.then(() => {
//     console.log('Message read');
//     console.log(message)
// });
// controller.sendMessage('Hello, World!', '9012113')
// controller.sendMessage('Hello, World!', '9012113')