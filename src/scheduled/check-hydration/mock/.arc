@app
mock

@http
get /
get /regular
get /extra/:fancy

## Uncomment the following lines to deploy to AWS!
# @aws
# profile default
# region us-west-1
# bucket your-private-deploy-bucket
