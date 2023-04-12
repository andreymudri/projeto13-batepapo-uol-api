import  {MongoClient}  from 'mongodb';
import express from "express";
import cors from "cors";
import joi from 'joi';
import dotenv from 'dotenv';
import dayjs from 'dayjs';

const app = express();
app.use(express.json());
app.use(cors());

dotenv.config();

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message));
/* */

/* */
app.post('/participants', async (req, res) => {
    const participantSchema = joi.object({
        name: joi.string().required()
    });
    try {
        const { error } = participantSchema.validate(req.body);
        if (error) {
            return res.status(422).json({ error: error.details[0].message });
        }

        const { name } = req.body;


        const existingParticipant = await db.collection('participants').findOne({ name });
        if (existingParticipant) {
            return res.status(409).json({ error: 'Participant name already in use' });
        }

        const participant = { name, lastStatus: Date.now() };
        await db.collection('participants').insertOne(participant);


        const time = dayjs().format('HH:mm:ss');
        const message = { from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time };
        await db.collection('messages').insertOne(message);

        return res.sendStatus(201);

    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});


/* */

/* */




/* */
const PORT = 5000;
app.listen(PORT, () => console.log(`Server online port ${PORT}.`));