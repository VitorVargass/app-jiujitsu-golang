package students

import "strconv"

func RankLabel(belt string, degrees int) string {
	if belt == "" {
		return "Sem graduação"
	}
	if degrees == 0 {
		return belt
	}
	unit := " graus"
	if degrees == 1 {
		unit = " grau"
	}
	return belt + " • " + strconv.Itoa(degrees) + unit
}
