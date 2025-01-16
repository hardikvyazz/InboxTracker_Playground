"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJsonFile = loadJsonFile;
exports.saveJsonFile = saveJsonFile;
const fs_1 = __importDefault(require("fs"));
function loadJsonFile(filePath) {
    console.log('Attempting to load JSON file from:', filePath);
    try {
        // Check if the path exists
        if (!fs_1.default.existsSync(filePath)) {
            console.error('File does not exist:', filePath);
            return null;
        }
        // Check if the path is a directory
        const stats = fs_1.default.lstatSync(filePath);
        if (stats.isDirectory()) {
            console.error('Error: Path is a directory, not a file:', filePath);
            return null;
        }
        // Read and parse the file
        const data = fs_1.default.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error('Error reading or parsing the JSON file:', error);
        return null;
    }
}
function saveJsonFile(filePath, data) {
    console.log('Saving JSON data to:', filePath);
    try {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log('File saved successfully.');
    }
    catch (error) {
        console.error('Error writing file:', error);
    }
}
