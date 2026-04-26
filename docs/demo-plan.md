# SoloLedger AI Demo Plan

## Project Summary

**Project name:** SoloLedger AI

**Project type:** Personal finance web application with AI-assisted guidance

**Target users:** Individuals who want a clearer and more organized way to track spending, manage budgets, plan savings goals, and monitor recurring financial commitments without needing advanced accounting knowledge.

**Core value proposition:** SoloLedger AI combines transaction tracking, budgeting, savings planning, recurring payment management, and an AI assistant in one workspace. The goal is not only to record financial activity, but to help users understand their money and make better decisions with less friction.

## Live Demo URL

Primary live URL for presentation:

`https://solo-ledger-ai.vercel.app/`

## Demo Goal

The goal of the demo is to show that SoloLedger AI is a complete, practical, and user-friendly finance application that:

- supports secure user authentication
- allows users to track income and expenses
- helps users plan with budgets and savings goals
- supports recurring bills and recurring income
- provides AI guidance based on financial context

## Recommended Demo Length

Total target length: **5 to 7 minutes**

Recommended timing:

1. Introduction and project purpose: 45-60 seconds
2. Main product flow: 3-4 minutes
3. Technical explanation: 1-1.5 minutes
4. Final value summary and wrap-up: 30-45 seconds

## Demo Script

### 1. Introduction

Start with a short and clear explanation:

> SoloLedger AI is a personal finance web app designed for people who want a simple but intelligent way to manage their money. It helps users track transactions, set budgets, create savings goals, manage recurring payments, and ask an AI assistant for practical financial guidance based on their own data.

### 2. Main Flow to Demonstrate

This is the strongest flow for the demo because it shows both product value and technical depth.

#### Step 1: Show the authenticated entry point

- Open the live app
- Briefly show login or explain that the app uses authenticated user access
- Enter the dashboard

Talking point:

> Each user has a protected workspace, so their transactions, planning data, and AI chat history remain private.

#### Step 2: Show the Overview dashboard

- Show monthly income, expenses, and net summary
- Show the setup checklist or recent activity area
- Show the weekly pulse / current financial snapshot

Talking point:

> The overview is designed to give the user an immediate understanding of their current financial state without overwhelming them.

#### Step 3: Add or explain a transaction

- Open the transaction modal
- Show the transaction fields
- Explain how income and expenses are recorded

Talking point:

> Transactions are the foundation of the whole system. Once the user adds data here, the dashboard, planning tools, and AI assistant all become more useful.

#### Step 4: Show Planning

- Navigate to the Planning section
- Show budgets
- Show savings goals
- Explain how the system compares spending against budget limits and tracks savings progress

Talking point:

> This part moves the app beyond simple expense tracking. It helps users actively plan their financial behavior rather than only reviewing the past.

#### Step 5: Show Recurring items

- Navigate to the Recurring section
- Show recurring bills, salary, subscriptions, or other fixed items
- Explain the purpose of due dates and one-click logging

Talking point:

> Recurring items reduce manual work and help users stay aware of fixed financial commitments like rent, salary, subscriptions, or regular transfers.

#### Step 6: Show the AI Assistant

- Open the AI Assistant
- Show the suggested prompts or ask one practical question
- Explain that the AI uses financial context from transactions, planning data, and recurring items

Suggested demo prompt:

> Review my spending and suggest one simple action for this week.

Talking point:

> The AI assistant is not generic chat. It is connected to the user’s financial context, so it can give more relevant and actionable suggestions.

### 3. Technical Points to Explain Briefly

Do not go too deep here. Keep the explanation short, confident, and structured.

#### Frontend

- Built with **Next.js App Router**
- Uses **React** and **TypeScript**
- Uses a modular UI structure with separate dashboard, planning, recurring, and AI views

#### Backend and data

- Uses **Supabase Auth** for login and signup
- Uses **Supabase Postgres** for storing transactions, budgets, savings goals, recurring items, and chat history
- Uses data-layer helper modules for cleaner separation of logic

#### AI integration

- The assistant receives summarized financial context
- This improves the relevance of AI responses compared to a generic chatbot

#### Product/UX decisions

- Focus on beginner-friendly language
- Added onboarding-oriented guidance
- Added bilingual foundation for **English and Albanian**

## What I Will Check Before the Demo

Before presenting, I will verify the following:

- the live URL opens correctly
- login and signup work
- demo account is ready
- dashboard loads without errors
- there is enough sample data to make the demo meaningful
- planning data is visible
- recurring items are visible
- AI assistant responds successfully
- language switcher works
- important buttons and forms behave correctly

## Demo Data Preparation

To avoid a weak or empty demo, I will make sure the account used for presentation includes:

- several income and expense transactions
- at least 2-3 category budgets
- at least 1-2 savings goals
- at least 2 recurring items
- enough data for the AI assistant to produce a contextual answer

## Plan B If the Live Demo Fails

If the live deployment becomes unavailable or unstable, I will use this fallback plan:

1. Use a local running version of the app.
2. Show the same flow using prepared sample data.
3. If network-based AI is unavailable, explain the fallback behavior and continue with the rest of the product flow.
4. If login has issues, use screenshots or already prepared authenticated pages to continue the explanation of the core features.

Plan B talking point:

> Even if the hosted version has a temporary issue, I can still demonstrate the application architecture, the user flow, and the completed features using the local build and prepared data.

## Why This Demo Flow Is Strong

This demo flow is strong because it shows:

- the main user problem
- the core features in logical order
- the difference between raw tracking and intelligent planning
- the practical value of the AI assistant
- both product quality and technical implementation

## Final Wrap-Up Line

End with a short summary like this:

> SoloLedger AI is built to make personal finance more understandable, structured, and actionable. It combines secure account-based tracking, planning features, recurring financial management, and AI guidance into a single workflow that is practical for real users.
