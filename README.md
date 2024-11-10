# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

# Required fields when creating the following 
## Adding a new book 
The url should look something like this ``https://mxy84w2780.execute-api.eu-west-1.amazonaws.com/dev/books``
```
{
  "adult": true,
  "id": 1,
  "genre_ids": [12, 18],
  "title": "Book Title",
  "original_language": "English",
  "original_title": "Original Book Title",
  "overview": "Brief summary of the book",
  "popularity": 7.5,
  "release_date": "2022-01-01",
  "vote_average": 8.2,
  "vote_count": 102,
  "translations": {
    "fr": {
      "title": "Titre du livre",
      "overview": "Résumé du livre en français"
    },
    "es": {
      "title": "Título del libro",
      "overview": "Resumen del libro en español"
    }
  }
}
```
## Getting all books
The url should look something like this ``https://yr8hsnldyb.execute-api.eu-west-1.amazonaws.com/dev/books``

## Getting a book by ID
The url should look like this ``https://dfrd2io6i2.execute-api.eu-west-1.amazonaws.com/dev/books/1``

## Deleting a book
The url should look like this ``https://dfrd2io6i2.execute-api.eu-west-1.amazonaws.com/dev/books/7``

## Updating a book
The url should look like this `` https://h0t4l2hjda.execute-api.eu-west-1.amazonaws.com/dev/books``
The Id field should NOt be included
```
{
  "adult": false,
  "genre_ids": [28, 14],
  "title": "The Light of the Sun",
  "original_language": "en",
  "original_title": "The Shadow of the Wind",
  "overview": "In post-war Barcelona, a young boy finds a mysterious book that changes his life forever, uncovering dark secrets linked to a forgotten author.",
  "popularity": 892.5,
  "release_date": "2001-04-01",
  "vote_average": 8.7,
  "vote_count": 4500,
  "translations": {}
}
```

## Translating fields in the table
The url should look like this ``https://00yo8kp3af.execute-api.eu-west-1.amazonaws.com/dev/books/1/translation?language=fr``

## User Signup
The url should look like this ``https://41hm5hw3d0.execute-api.eu-west-1.amazonaws.com/prod/auth/signup``
```
{
  "username": "newuser",
  "password": "password123",
  "email": "newuser@example.com"
}
```

## Confirming signup
The url should look like this ``https://41hm5hw3d0.execute-api.eu-west-1.amazonaws.com/prod/auth/confirm_signup``
A special code will be sent to the email provided when singing up

```
{
  "username": "newuser",
  "code": "123456"
}
```

## User Signin
The url should look like this https://41hm5hw3d0.execute-api.eu-west-1.amazonaws.com/prod/auth/signin
```
{
  "username": "newuser",
  "password": "password123"
}
```