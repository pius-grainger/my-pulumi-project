export const handler = async (event: any) => {
    console.log("SNS Event:", event);
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Hello from SNS!" }),
    };
};

