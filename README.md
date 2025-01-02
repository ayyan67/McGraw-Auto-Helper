# McGraw Auto Helper

A Tampermonkey script that automates McGraw Hill Connect assignments using GPT-powered assistance.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for your browser.
2. Open Tampermonkey and create a new script.
3. Copy and paste the contents of `mcgraw.user.js` into the script editor.
4. Update the `CONFIG` section with your OpenAI API credentials.
5. Save the script and ensure it's enabled.

## Features

- **Automatic Question Handling**: Supports Multiple Choice, Multiple Select, and Matching questions.
- **Answer Learning**: Learns from incorrect attempts and caches correct answers for future use.
- **GPT Integration**: Uses OpenAI's GPT-4o-mini for determining answers to new questions.
- **Control Panel**: Simple UI for toggling automation, viewing stats, and managing saved answers.
- **Customizable Behavior**: Configurable delays, debug options, and confidence settings.
- **Answer Caching**: Stores answers locally to reduce redundant API calls and improve efficiency.

## Configuration

Update the `CONFIG` section in the script as follows:
```javascript
const CONFIG = {
    OPENAI_API_KEY: 'YOUR_API_KEY',       // Replace with your OpenAI API key
    MODEL: 'gpt-4o-mini',                // Model to use
    AUTO_MODE: true,                     // Enable or disable automation by default
    DEBUG: true,                         // Enable detailed logging
    DELAY: 1500                          // Delay (in ms) between actions
};
```

## Usage

1. Navigate to your McGraw Hill Connect assignment.
2. The automation will:
   - Detect and answer questions automatically.
   - Store and reuse correct answers for similar questions in the future.
3. Use the Control Panel to:
   - Toggle automation on/off.
   - Manually trigger answer attempts.
   - Clear the answer cache.
   - View statistics on answered questions.

## Screenshots

### Installation Guide
_A screenshot showing the Tampermonkey extension in the browser toolbar._

### Control Panel
_A screenshot of the control panel in action, highlighting the toggle button, manual answer button, and stats._

### Answer Automation
_A screenshot showing the script selecting answers on a McGraw Hill Connect question._

## Notes

- Compatible with most McGraw Hill Connect courses.
- Requires a valid OpenAI API key for GPT functionality.
- Stores answers securely in browser `localStorage`.
- Minimal permissions and system resource usage.

## Disclaimer

This tool is for educational purposes only. Use responsibly and in accordance with your institution's academic integrity policies.
