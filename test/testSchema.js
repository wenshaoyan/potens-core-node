const { makeExecutableSchema, mergeSchemas } = require('graphql-tools');

const { printSchema } = require('graphql');

const {baseSchemaString} = require('../index');
const s = makeExecutableSchema(baseSchemaString());
const typeDefs = `
        type Query{
            testStatus1: Boolean
        }
    `;
const resolvers = {
    Query: {
        testStatus1() {
            return true;
        }
    }
};
const c = makeExecutableSchema({
    typeDefs,
    resolvers
});
const r = mergeSchemas({
    schemas: [s,c]
})
console.log(printSchema(r))

