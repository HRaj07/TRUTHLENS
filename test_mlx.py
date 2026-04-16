import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np

class M(nn.Module):
    def __init__(self):
        super().__init__()
        self.l = nn.Linear(10, 2)
    def __call__(self, x):
        return self.l(x)

m = M()
mx.eval(m.parameters())
opt = optim.Adam(learning_rate=0.01)

def loss_fn(model, x, y):
    return mx.mean(nn.losses.cross_entropy(model(x), y))

loss_and_grad_fn = nn.value_and_grad(m, loss_fn)

def step(x, y):
    loss, grads = loss_and_grad_fn(m, x, y)
    opt.update(m, grads)
    return loss

X = mx.random.normal((4, 10))
y = mx.array([0, 1, 0, 1])

for i in range(2):
    loss = step(X, y)
    mx.eval(m.state, opt.state, loss)
    print(loss)
