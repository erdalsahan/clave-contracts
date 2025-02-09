#!/bin/bash

# Run era_test_node in the background and redirect its output to /dev/null
era_test_node run > /dev/null &
# Save the last process ID
export LAST_PID=$!

# Run hardhat tests with the specified environment and network
NODE_ENV=test hardhat test --network zkSyncTestnet

# Kill the background process
kill -9 $LAST_PID
