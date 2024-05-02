const { MotorolaSerialPort, SDSReceivedMessage, SDSSentMessage } = require('./export');
const serialParser = require('../utils/serialParser');

class TetraController {
    #serialPort = null
    #eventCallbacks = [];
    #sentMessages = []

    /**
     * Creates an instance of TetraController.
     * @param {string} port - The port to connect to.
     */
    constructor({ serialPort, baudRate}) {
        this.#serialPort = new MotorolaSerialPort(serialPort, baudRate);
        this.#serialPort.on('data', this.#onData.bind(this));

        this.#serialPort.write('AT+CTSP=1,3,130\r\n') //Activate SDS pipe to PEI 
        this.#serialPort.write('AT+CTSP=1,3,131\r\n') //Activate GPS pipe to PEI
        //this.#serialPort.write('AT+CTSP=1,2,20\r\n') //Register SDS status handling
        this.#serialPort.write('AT+CTSP=1,3,10\r\n') //Register GPS LIP hanadling

        setInterval(() => {
            this.#serialPort.write('AT+CTBCT?\r\n');
            this.#serialPort.write('AT+CSQ?\r\n');
            this.#serialPort.write('AT+CNUM?\r\n');
        }, 10000000);

        var self = this;
        setInterval(() => this.#sendMessages(self), 1000);
    }

    sendMessage(message, recipient, options){
        //message length must be 160 characters or less
        if(message.length > 160) return;

        const messageId = this._getMessageId();
        const sdsMessage = new SDSSentMessage(recipient, message, messageId, new Date(), false, null, options?.deliveredReport || true, false, null, options?.readReport || true);
        this.#sentMessages.push(sdsMessage);

        this.#eventCallbacks.forEach(callback => {
            if(callback.event == 'sentMessageCreate'){
                callback.callback(sdsMessage);
            }
        });

        return sdsMessage;
    }

    presenceCheck(issi, timeout = 10000){
        return new Promise(res=>{
            const messageId = this._getMessageId();
            const sdsMessage = new SDSSentMessage(issi, 'PRESCHECK', messageId, new Date(), false, null, true, true, null, false);
            sdsMessage.presenceCheck = true;
            this.#sentMessages.push(sdsMessage);

            const callbackIndex = this.#eventCallbacks.push({
                event: 'messageReceived',
                callback: (message) => {
                    if(parseInt(message.sentBy) == issi){
                        this.#eventCallbacks.splice(callbackIndex, 1);
                        res(true);
                    }
                }
            });

            setTimeout(() => {
                this.#eventCallbacks.splice(callbackIndex, 1);
                res(false);
            }, timeout);

        })
    }

    on(event, callback){
        this.#eventCallbacks.push({event, callback});
    }

    #sendMessages(self){
        var unsentMessages = self.#sentMessages.find(m => m.sent == false && m.sentAt == null);
        if(unsentMessages){
            const serialData = unsentMessages.toSerial(unsentMessages?.presenceCheck || false)
            const hexLength = serialData.length*4
            unsentMessages.sentAt = new Date();
            
            this.#serialPort.write(`AT+CMGS=${unsentMessages.sentTo},${hexLength}\r\n${serialData}\x1A`);
        }
    }

    #onData(data) {
        const serialData = serialParser(data, this.#serialPort);
        if(serialData == null) return;

        if(serialData?.countryCode) this.countryCode = serialData.countryCode;
        if(serialData?.networkCode) this.networkCode = serialData.networkCode;
        if(serialData?.subscriberNumber) this.subscriberNumber = serialData.subscriberNumber;
        if(serialData?.signalStrength) this.signalStrength = serialData.signalStrength;
        if(serialData?.sdsAvailable) this.sdsAvailable = serialData.sdsAvailable;

        //log type of message
        if(serialData instanceof SDSReceivedMessage){
            this.#eventCallbacks.forEach(callback => {
                if(callback.event == 'messageReceived'){
                    callback.callback(serialData);
                }
            });
        }

        if(serialData?.type == 'gpsMessage'){
            this.#eventCallbacks.forEach(callback => {
                if(callback.event == 'gps'){
                    callback.callback(serialData);
                }
            });
        }



        if(serialData?.type == 'receivedReceipt' || serialData?.type == 'readReceipt' || serialData?.type == 'messageSent'){
            var message = this.#sentMessages.find(m => m.messageId == serialData.messageId);
            if(message == null) return;

            if(serialData.type == 'messageSent') {
                message.sent = true;
                message.sentAt = new Date();
                message.sentResolve(true);

                this.#eventCallbacks.forEach(callback => {
                    if(callback.event == 'sendMessageSent'){
                        callback.callback(message);
                    }
                });

            }

            if(serialData.type == 'receivedReceipt') {
                message.deliveredAt = new Date();
                message.delivered = true;
                message.deliveredResolve(true);

                this.#eventCallbacks.forEach(callback => {
                    if(callback.event == 'sendMessageReceived'){
                        callback.callback(message);
                    }
                });
            }

            if(serialData.type == 'readReceipt') {
                message.readAt = new Date();
                message.read = true;
                message.readResolve(true);

                this.#eventCallbacks.forEach(callback => {
                    if(callback.event == 'sendMessageRead'){
                        callback.callback(message);
                    }
                });
            }
        }
    }

    _getMessageId(){
        var id = 0;
        for(var i = 1; i < 200; i++){
            if(this.#sentMessages.find(m => m.messageId == i) == null) id = i;
        }
    
        if(id == 0) {
            var messagesWithTetrareference = this.#sentMessages.map(m => m.messageId);
    
            //set tetraReference to 0 on oldest message 
            var oldestMessage = his.#sentMessages.find(m => m.messageId == Math.min(...messagesWithTetrareference));
            oldestMessage.messageId = 0;
    
            //try again
            return this._getMessageId();
        }
    
        return id;
    }


}

module.exports = TetraController;