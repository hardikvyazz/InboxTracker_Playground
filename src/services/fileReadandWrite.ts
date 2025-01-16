import fs from 'fs';

export function loadJsonFile<T>(filePath: string): T | null {
  console.log('Attempting to load JSON file from:', filePath);

  try {
    // Check if the path exists
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      return null;
    }

    // Check if the path is a directory
    const stats = fs.lstatSync(filePath);
    if (stats.isDirectory()) {
      console.error('Error: Path is a directory, not a file:', filePath);
      return null;
    }

    // Read and parse the file
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('Error reading or parsing the JSON file:', error);
    return null;
  }
}

export function saveJsonFile<T>(filePath: string, data: T): void {
  console.log('Saving JSON data to:', filePath);

  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('File saved successfully.');
  } catch (error) {
    console.error('Error writing file:', error);
  }
}
