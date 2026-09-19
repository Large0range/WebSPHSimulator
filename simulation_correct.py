import math

j = 4
H = 10
k = 1
mass = 1
target_density = 0.5
external_force = (0,0)

particles = [(17,3), (5,4), (8,20), (9,10), (11,3)]
velocities = [(2,0), (0,0), (0,0), (0,0), (-1,0)]
external_forces = [(0,0), (0,0), (0,0), (0,0), (0,0)]

print("particle", j+1, particles[j])

def sub_vec(a, b):
	return (a[0]-b[0], a[1]-b[1])

def mag_vec(a):
	return math.sqrt(a[0]**2 + a[1]**2)

def poly6_kernel(i, j):
	rvec = sub_vec(particles[i], particles[j])
	rmag = mag_vec(rvec)

	coeff = 4/(math.pi * H**8)

	if rmag < 0 or rmag > H:
		return 0
	else:
		return ((H**2 - rmag**2)**3) * coeff


def spike_gradient(i, j):
	rvec = sub_vec(particles[i], particles[j])
	rmag = mag_vec(rvec)

	coeff = -10/(math.pi * H**5)
	
	if rmag < 0 or rmag > H:
		return (0,0)
	else:
		vmul0 = (H - rmag)**2 * rvec[0]/rmag
		vmul1 = (H - rmag)**2 * rvec[1]/rmag

		return (coeff * vmul0, coeff * vmul1)


def visc_laplacian(i, j):
	rvec = sub_vec(particles[i], particles[j])
	rmag = mag_vec(rvec)

	coeff = 40 / (math.pi * H**5)

	if rmag < 0 or rmag > H:
		return 0
	else:
		return coeff * (H - rmag)

def calculate_pressure(d):
	return k*(d - target_density)


def calculate_density(a):
	density = 0
	for i in range(0, len(particles)):	
		density += mass * poly6_kernel(a, i)

	return density


def calculate_pressure_force(a):
	pressure = [0,0]
	for i in range(len(particles)):
		if a == i:
			continue

		gradient = spike_gradient(a,i)

		if gradient[0] == 0 and gradient[1] == 0:
			continue

		da = calculate_density(a)
		pa = calculate_pressure(da)

		di = calculate_density(i)
		pi = calculate_pressure(di)

		coeff = (pa / da**2 + pi / di**2)
		
		pressure[0] += coeff * gradient[0]
		pressure[1] += coeff * gradient[1]

	return (-pressure[0], -pressure[1])


def calculate_viscosity_force(a):
	visc_force = [0,0]
	for i in range(len(particles)):
		if a == i:
			continue

		visc = visc_laplacian(a,i)
		
		if visc == 0:
			continue

		visc_force[0] += mass * ((velocities[i][0] - velocities[a][0]) / calculate_density(i)**2) * visc
		visc_force[1] += mass * ((velocities[i][1] - velocities[a][1]) / calculate_density(i)**2) * visc

	return (visc_force[0], visc_force[1])



def calculate_external_force(a):
	density = calculate_density(a)
	return (external_forces[a][0] * density, external_forces[a][1] * density)



for i in range(0, len(particles)):
	print("distance", j+1, i+1, mag_vec(sub_vec(particles[i], particles[j])))


density = calculate_density(j)
print("density", j+1, density)

pressure_force = calculate_pressure_force(j)
print("pressure force", j+1, pressure_force)

visc_force = calculate_viscosity_force(j)
print("viscosity force", j+1, visc_force)

ext_force = calculate_external_force(j)
print("external force", j+1, ext_force)
