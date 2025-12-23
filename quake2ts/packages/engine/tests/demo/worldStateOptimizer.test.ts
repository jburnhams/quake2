    const createEntity = (num: number, modelindex: number, sound: number = 0): EntityState => {
        const ent = createEmptyEntityState();
        const mutableEnt = ent as any;
        mutableEnt.number = num;
        mutableEnt.modelIndex = modelindex;
        mutableEnt.sound = sound;
        // Also attach bits for optimizer checks
        let bits = 0;
        if (modelindex > 0) bits |= U_MODEL;
        if (sound > 0) bits |= U_SOUND;
        mutableEnt.bits = bits;
        return ent;
    };
