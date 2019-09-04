@app
hydrate-failure-test-case

@aws
region us-west-1
profile smallwins
bucket cf-sam-deployments

@scheduled
check-hydration rate(5 minutes)
