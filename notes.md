summary row:
account_id, limit, balance, pending, revision

transactions:
account_id, details, amount, status

actions:
account_id, action, data

## initial state

summary
limit: 100, balance: 0 pending: 0 revision: 0
transactions
actions

## request approval

actions
action: set-limit, amount: 100
action: approve, transaction: 1, amount: 10

summary
limit: 100, balance: 0, pending: 10, revision: 1

transactions
id: 0, amount: 10, status: pending

## capture transaction

actions
action: set-limit, amount: 100
action: approve, transaction: 1, amount: 10
action: capture, transaction: 1

summary
limit: 100, balance: 10, pending: 0, revision: 2

transactions
id: 0, amount: 10, status: captured
