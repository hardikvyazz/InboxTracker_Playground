"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const constants_1 = require("./conf/constants");
const authService_1 = require("./services/authService");
const emailProcessor_1 = require("./services/emailProcessor");
const app = (0, express_1.default)();
app.listen(constants_1.PORT, () => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`Server running on http://localhost:${constants_1.PORT}`);
    try {
        const auth = yield (0, authService_1.authorize)(app); // Pass the app instance
        console.log('Authorized successfully.');
        console.log(auth);
        yield (0, emailProcessor_1.processReports)(auth);
    }
    catch (error) {
        console.error('Authorization Failed:', error);
    }
}));
