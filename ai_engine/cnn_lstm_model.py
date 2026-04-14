from tensorflow.keras import layers, models

def build_model():
    model = models.Sequential()

    # CNN
    model.add(layers.TimeDistributed(
        layers.Conv2D(32,(3,3),activation='relu'),
        input_shape=(10,48,48,1)
    ))
    model.add(layers.TimeDistributed(layers.BatchNormalization()))
    model.add(layers.TimeDistributed(layers.MaxPooling2D(2,2)))

    model.add(layers.TimeDistributed(
        layers.Conv2D(64,(3,3),activation='relu')
    ))
    model.add(layers.TimeDistributed(layers.BatchNormalization()))
    model.add(layers.TimeDistributed(layers.MaxPooling2D(2,2)))

    model.add(layers.TimeDistributed(
        layers.Conv2D(128,(3,3),activation='relu')
    ))
    model.add(layers.TimeDistributed(layers.MaxPooling2D(2,2)))

    model.add(layers.TimeDistributed(layers.Flatten()))

    # LSTM
    model.add(layers.LSTM(128, return_sequences=False))

    # Dense
    model.add(layers.Dense(128, activation='relu'))
    model.add(layers.Dropout(0.5))
    model.add(layers.Dense(7, activation='softmax'))

    model.compile(
        optimizer='adam',
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    return model  