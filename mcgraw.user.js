// ==UserScript==
// @name         McGraw Answer Bot (Complete)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-answers McGraw Hill questions with GPT-4o-mini and answer caching
// @author       You
// @match        https://learning.mheducation.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        OPENAI_API_KEY: 'YOUR_KEY_HERE',
        MODEL: 'gpt-4o-mini',
        AUTO_MODE: true,
        DEBUG: true,
        DELAY: 1500
    };

    // Enhanced answer cache with wrong answer tracking
    const Cache = {
        data: JSON.parse(localStorage.getItem('mcgrawAnswers') || '{}'),

        save(question, data) {
            const entry = {
                type: data.type,
                correctAnswers: data.correctAnswers,
                wrongAnswers: data.wrongAnswers || [],
                lastAttempt: data.lastAttempt,
                timestamp: Date.now(),
                attempts: (this.data[question]?.attempts || 0) + 1
            };

            this.data[question] = entry;
            localStorage.setItem('mcgrawAnswers', JSON.stringify(this.data));
            this.updateStats();
        },

        get(question) {
            return this.data[question];
        },

        clear() {
            this.data = {};
            localStorage.removeItem('mcgrawAnswers');
            this.updateStats();
        },

        updateStats() {
            const stats = {
                total: Object.keys(this.data).length,
                multipleChoice: {
                    correct: 0,
                    incorrect: 0
                },
                multipleSelect: {
                    correct: 0,
                    incorrect: 0
                }
            };

            for (const entry of Object.values(this.data)) {
                if (entry.type === 'multipleSelect') {
                    if (entry.lastAttempt?.correct) stats.multipleSelect.correct++;
                    else stats.multipleSelect.incorrect++;
                } else {
                    if (entry.lastAttempt?.correct) stats.multipleChoice.correct++;
                    else stats.multipleChoice.incorrect++;
                }
            }

            const statsDiv = document.getElementById('stats');
            if (statsDiv) {
                statsDiv.innerHTML = `
                    <div>Multiple Choice: ${stats.multipleChoice.correct}/${stats.multipleChoice.correct + stats.multipleChoice.incorrect}</div>
                    <div>Multiple Select: ${stats.multipleSelect.correct}/${stats.multipleSelect.correct + stats.multipleSelect.incorrect}</div>
                `;
            }
        }
    };

    const Logger = {
        log(message, data = null) {
            if (CONFIG.DEBUG) {
                console.log(`[McGraw Bot] ${message}`, data || '');
                this.updateStatus(message);
            }
        },

        error(message, error = null) {
            console.error(`[McGraw Bot] ERROR: ${message}`, error || '');
            this.updateStatus(`Error: ${message}`);
        },

        updateStatus(message) {
            const status = document.getElementById('botStatus');
            if (status) status.textContent = message;
        }
    };

    const QuestionHandler = {
        isMultipleSelect() {
            return document.querySelector('.multiple-select-component') !== null ||
                   document.querySelector('.mcms-fieldset') !== null ||
                   document.querySelector('h2')?.textContent.includes('Multiple Select');
        },

        getQuestionText() {
            return document.querySelector('.prompt')?.textContent.trim();
        },

        getAnswerChoices() {
            return [...document.querySelectorAll('.choiceText')].map(el => el.textContent.trim());
        },

        selectAnswers(answers, isMultipleSelect) {
            Logger.log('Selecting answers:', answers);

            if (isMultipleSelect) {
                const checkboxes = document.querySelectorAll('.ahe-ui-checkbox input[type="checkbox"]');
                let selected = 0;

                checkboxes.forEach(checkbox => {
                    const choiceText = checkbox.closest('.ahe-ui-checkbox')
                        ?.querySelector('.choiceText')?.textContent.trim();

                    if (choiceText && answers.includes(choiceText)) {
                        checkbox.click();
                        selected++;
                        Logger.log('Selected:', choiceText);
                    }
                });

                return selected > 0;
            } else {
                const radioButtons = document.querySelectorAll('.ahe-ui-radio input[type="radio"]');
                for (const radio of radioButtons) {
                    const choiceText = radio.closest('.ahe-ui-radio')
                        ?.querySelector('.choiceText')?.textContent.trim();

                    if (choiceText === answers[0]) {
                        radio.click();
                        Logger.log('Selected:', choiceText);
                        return true;
                    }
                }
            }
            return false;
        },

        clickHighConfidence() {
            setTimeout(() => {
                const highBtn = document.querySelector('[data-automation-id="confidence-buttons--high_confidence"]');
                if (highBtn && !highBtn.disabled) {
                    highBtn.click();
                    Logger.log('Clicked high confidence');
                }
            }, CONFIG.DELAY);
        },

        getCorrectAnswer() {
            const container = document.querySelector('.correct-answer-container');
            if (!container) return null;

            const correctAnswers = [...container.querySelectorAll('.choiceText')]
                .map(el => el.textContent.trim());

            const wrongAnswers = [...document.querySelectorAll('.choice-row.-incorrect .choiceText')]
                .map(el => el.textContent.trim());

            return {
                correctAnswers,
                wrongAnswers,
                reasoning: [...document.querySelectorAll('.choiceRationale')]
                    .map(el => {
                        const choice = el.closest('.choice-row')?.querySelector('.choiceText')?.textContent.trim();
                        const reason = el.textContent.replace('Reason:', '').trim();
                        return { choice, reason };
                    })
            };
        },

        async handleForcedLearning() {
            Logger.log('Handling forced learning...');

            // First try to click "Read About the Concept"
            const readButton = document.querySelector('[data-automation-id="lr-tray_reading-button"]');
            if (readButton) {
                Logger.log('Clicking Read About Concept button');
                readButton.click();

                // Wait for and click "To Questions" button
                await new Promise((resolve) => {
                    const checkForToQuestions = setInterval(() => {
                        const toQuestionsBtn = document.querySelector('[data-automation-id="reading-questions-button"]');
                        if (toQuestionsBtn) {
                            clearInterval(checkForToQuestions);
                            Logger.log('Clicking To Questions button');
                            toQuestionsBtn.click();
                            resolve();
                        }
                    }, 1000);

                    // Timeout after 30 seconds
                    setTimeout(() => {
                        clearInterval(checkForToQuestions);
                        Logger.error('Timeout waiting for To Questions button');
                        resolve();
                    }, 30000);
                });

                return true;
            }
            return false;
        },

        isForcedLearning() {
            return document.querySelector('.forced-learning') !== null ||
                   document.querySelector('.alert-error') !== null;
        },

        clickNextQuestion() {
            Logger.log('Looking for Next Question button...');

            setTimeout(async () => {
                // Check for forced learning first
                if (this.isForcedLearning()) {
                    Logger.log('Detected forced learning scenario');
                    await this.handleForcedLearning();
                    return;
                }

                const nextButtons = [
                    ...document.querySelectorAll('button'),
                    ...document.querySelectorAll('.next-button'),
                    ...document.querySelectorAll('[class*="next-button"]')
                ].filter(btn =>
                    btn.textContent.toLowerCase().includes('next') ||
                    btn.className.toLowerCase().includes('next')
                );

                if (nextButtons.length > 0) {
                    Logger.log('Found Next Question button. Clicking...');
                    nextButtons[0].click();
                } else {
                    Logger.error('Next Question button not found');
                }
            }, CONFIG.DELAY * 3);
        },






    };

    const AI = {
        async getAnswer(question, choices, isMultipleSelect, previousAttempts = null) {
            let prompt = {
                model: CONFIG.MODEL,
                messages: [
                    {
                        role: "system",
                        content: isMultipleSelect ?
                            "You are answering a multiple select question. ONLY list answers you are VERY confident are correct. DO NOT include any answers you're unsure about." :
                            "You are answering a multiple choice question. Select the single best answer."
                    },
                    {
                        role: "user",
                        content: `Question: ${question}\n\nChoices:\n${choices.map(c => `- ${c}`).join('\n')}\n\n${
                            isMultipleSelect ?
                            "List ONLY the answers you are VERY confident are correct, one per line. It's better to miss a correct answer than to include a wrong one." :
                            "Provide only the single best answer."
                        }`
                    }
                ]
            };

            // If there were previous wrong attempts, include them
            if (previousAttempts?.wrongAnswers?.length > 0) {
                prompt.messages.push({
                    role: "user",
                    content: `Previous incorrect answers: ${previousAttempts.wrongAnswers.join(', ')}`
                });
            }

            try {
                const response = await this.makeRequest(prompt);
                const answers = this.parseResponse(response, choices);
                Logger.log('AI answers:', answers);
                return answers;
            } catch (error) {
                Logger.error('AI Error:', error);
                return [choices[0]];
            }
        },

        makeRequest(data) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: "POST",
                    url: "https://api.openai.com/v1/chat/completions",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${CONFIG.OPENAI_API_KEY}`
                    },
                    data: JSON.stringify(data),
                    onload: function(response) {
                        if (response.status === 200) {
                            resolve(JSON.parse(response.responseText));
                        } else {
                            reject(new Error(`API Error: ${response.status}`));
                        }
                    },
                    onerror: reject
                });
            });
        },

        parseResponse(response, choices) {
            const content = response.choices[0].message.content.trim();
            const answerLines = content.split('\n')
                .map(line => line.trim().replace(/^-\s*/, ''))
                .filter(line => line.length > 0);

            return answerLines
                .map(answer => choices.find(choice =>
                    choice.toLowerCase() === answer.toLowerCase() ||
                    choice.toLowerCase().includes(answer.toLowerCase()) ||
                    answer.toLowerCase().includes(choice.toLowerCase())
                ))
                .filter(answer => answer);
        }
    };

    // Update the handleQuestion function:

async function handleQuestion(retryCount = 0) {
    const MAX_RETRIES = 3;  // Maximum times to retry a question before forcing read

    const questionText = QuestionHandler.getQuestionText();
    if (!questionText) return;

    if (QuestionHandler.isForcedLearning()) {
        Logger.log('In forced learning - handling first');
        await QuestionHandler.handleForcedLearning();
        return;
    }

    const isMultipleSelect = QuestionHandler.isMultipleSelect();
    const choices = QuestionHandler.getAnswerChoices();
    const cachedAnswer = Cache.get(questionText);

    Logger.log(`Processing ${isMultipleSelect ? 'multiple select' : 'multiple choice'} question. Attempt: ${retryCount + 1}`);

    let answers;
    if (cachedAnswer?.correctAnswers && !cachedAnswer.lastAttempt?.hadErrors) {
        answers = cachedAnswer.correctAnswers;
        Logger.log('Using cached correct answer:', answers);
    } else {
        answers = await AI.getAnswer(questionText, choices, isMultipleSelect, retryCount);
    }

    if (QuestionHandler.selectAnswers(answers, isMultipleSelect)) {
        QuestionHandler.clickHighConfidence();

        // Wait for feedback
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY * 2));

        // Check if we got it wrong and need to retry
        if (document.querySelector('.awd-probe-correctness.incorrect') !== null) {
            if (retryCount < MAX_RETRIES) {
                Logger.log(`Wrong answer, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
                await handleQuestion(retryCount + 1);
            } else {
                Logger.log('Max retries reached, accepting forced learning');
                QuestionHandler.clickNextQuestion();  // This will handle forced learning
            }
        } else {
            QuestionHandler.clickNextQuestion();
        }
    }



}


    function addControlPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="position: fixed; top: 10px; right: 100px; z-index: 9999;
                        background: white; padding: 10px; border: 1px solid #ccc; border-radius: 3px;">
                <div style="margin-bottom: 5px;">
                    <button id="toggleAuto" style="background: #4CAF50; color: white;">Auto: ON</button>
                    <button id="manualAnswer">Answer Once</button>
                    <button id="clearCache">Clear Cache</button>
                </div>
                <div id="botStatus" style="font-size: 12px; margin-top: 5px;">Ready</div>
                <div id="stats" style="font-size: 11px; margin-top: 3px;"></div>
            </div>
        `;
        document.body.appendChild(panel);

        document.getElementById('toggleAuto').onclick = () => {
            CONFIG.AUTO_MODE = !CONFIG.AUTO_MODE;
            const btn = document.getElementById('toggleAuto');
            btn.textContent = `Auto: ${CONFIG.AUTO_MODE ? 'ON' : 'OFF'}`;
            btn.style.background = CONFIG.AUTO_MODE ? '#4CAF50' : '#f44336';
        };

        document.getElementById('manualAnswer').onclick = () => handleQuestion(true);
        document.getElementById('clearCache').onclick = () => {
            if (confirm('Clear answer cache?')) Cache.clear();
        };
    }

    function init() {
        Logger.log('Initializing...');
        addControlPanel();
        Cache.updateStats();

        // Auto-answer observer
        const observer = new MutationObserver(() => {
            if (CONFIG.AUTO_MODE) {
                const question = document.querySelector('.prompt');
                if (question && !question.dataset.processed) {
                    question.dataset.processed = 'true';
                    handleQuestion();
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Update stats periodically
        setInterval(() => Cache.updateStats(), 5000);
    }

    // Start the script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
