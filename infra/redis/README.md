# Paste this line into redis.conf on the Redis host (WSL), then restart Redis.

# The live password hash is written to the gitignored file redis.conf.snippet

# by: pnpm redis:bootstrap

#

# Example shape (do NOT commit the real hash):

# user fragrance_chemistry_redis_user on #<sha256> ~fc:* &fc:* +@all -@admin -@dangerous +info
