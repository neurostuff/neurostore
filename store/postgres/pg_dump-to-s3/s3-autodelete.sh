#!/bin/bash

# Usage:
# ./s3-autodelete.sh bucket/path "7 days"

set -e

# Maximum date (will delete all files older than this date)
maxDate=`date +%s --date="-$2"`

# Collect files and identify newest (keep at least one backup)
newest_ts=0
newest_key=""
keys=()
timestamps=()

while read -r line; do
    [[ -z "$line" ]] && continue
    [[ "$line" == *"PRE "* ]] && continue

    fileDate=$(echo "$line" | awk '{print $1" "$2}')
    fileKey=$(echo "$line" | awk '{print $4}')
    [[ -z "$fileKey" ]] && continue

    fileTs=$(date -d"$fileDate" +%s)
    keys+=("$fileKey")
    timestamps+=("$fileTs")

    if [[ "$fileTs" -gt "$newest_ts" ]]; then
        newest_ts="$fileTs"
        newest_key="$fileKey"
    fi
done < <(aws s3 ls s3://$1/)

# Loop thru files and delete old ones, but keep the newest backup
for i in "${!keys[@]}"; do
    fileKey="${keys[$i]}"
    fileTs="${timestamps[$i]}"

    if [[ "$fileTs" -lt "$maxDate" && "$fileKey" != "$newest_key" ]]; then
        echo "* Delete $fileKey";
        aws s3 rm s3://$1/$fileKey
    fi
done
