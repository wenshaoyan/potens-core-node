const typeDefs = `
        interface Node{
            _sid: String!
        }
        type Query{
            testStatus: Boolean
        }
        type Mutation{
            testStatus: Boolean
        }
        schema {
            query: Query
            mutation: Mutation  
        }
    `;
const resolvers = {
    Query: {
        testStatus() {
            return true;
        }
    },
    Mutation: {
        testStatus() {
            return false;
        }
    }
};
const baseSchemaString = () => {
    return {
        typeDefs,
        resolvers
    };
};

module.exports = {baseSchemaString}


