export const handler = async (event: any) => {
    console.log("API Gateway Event:", event);
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Hello from API Gateway!" }),
    };
};

