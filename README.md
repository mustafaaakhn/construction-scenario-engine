# Construction Scenario Engine

A small browser app for trying out different cost and payment scenarios for a construction project.

## Why I made this

My dad is a civil engineer. I used to see him working in Excel, changing numbers to figure out what might happen on a project. What if steel gets more expensive? What if a payment arrives late? What if the work takes a few extra months?

That gave me the idea for this project. As a Computer Systems student, I wanted to build something connected to a real problem I had seen, and hopefully make those calculations a little easier for him.

The idea is simple: enter a plan once, change a few things, and compare the results side by side. I kept it as a small project that runs in the browser, without accounts or a database.

## What it does

You enter the contract value, the work duration, and the amounts you expect to bill and spend each month. The app calculates the profit before tax, loan interest and how much borrowing might be needed along the way.

Then you can try different combinations. For example:

- Steel costs increase by 20%.
- Steel increases by 20% and labour by 15%.
- Both costs increase, payments arrive two months later, and the work takes four months longer.

You can compare up to three scenarios with the original plan and see their monthly cash balances on a chart. You can also add your own cost items, such as transport or equipment, and remove ones you do not need.

The **Project limits** section checks how far a cost, delay or duration can increase before the project starts losing money or passes a target you choose.

## How to open it

Download the project folder (on GitHub: **Code → Download ZIP**), unzip it, and double-click **index.html**. It opens in your browser. There is nothing to install and it works offline.

Keep the files together in the same folder, including the `vendor` folder used by the chart.

The first visit starts with a blank form. Click **Load example** if you want to try it without filling everything in yourself. The example numbers are made up.

The app tries to save your inputs in the browser. When opening a local file, this depends on your browser and where the folder is saved, so use **Save file** to keep a backup and **Open file** to bring it back. A project saved at the old local server address can be moved over using these buttons too.

## A few things to know

- The page supports English and Turkish. EUR, USD and TL change the currency label only; they do not convert the amounts.
- Amounts use dots for thousands and a comma for cents, like `25.000,50`.
- Monthly billing needs to add up to the contract value. Enter monthly overhead separately so it is not counted twice.
- This is a simplified monthly calculation. It includes loan interest, but leaves out tax, deductions, price adjustments and cash movements within a month. The results are estimates based on the plan you enter.

## Built with

JavaScript, HTML and CSS, with a local copy of Chart.js for the graph. Its license is included in the `vendor` folder.

The calculation and data checks are in `tests`. Open **tests/index.html** to run them in your browser.
