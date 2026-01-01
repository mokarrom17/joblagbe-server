/* JWT using firebase


1.After user login, firebase is giving us access Token

2.
fetch("", {
headers:{
    authorization: `Bearer ${token}`
}
})

3.set a middleware to verify token

*/
